
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const { validationResult } = require('express-validator');

// @desc    Get single comment
// @route   GET /api/comments/:id
// @access  Public
exports.getComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id)
      .populate('author', 'username')
      .populate('post', 'title');

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: comment
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update comment
// @route   PUT /api/comments/:id
// @access  Private
exports.updateComment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    let comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      });
    }

    // Make sure user is comment author
    if (comment.author.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to update this comment'
      });
    }

    comment = await Comment.findByIdAndUpdate(
      req.params.id,
      { content: req.body.content },
      {
        new: true,
        runValidators: true
      }
    ).populate('author', 'username');

    res.status(200).json({
      success: true,
      data: comment
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private
exports.deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      });
    }

    // Get post to check if user is post author or community moderator
    const post = await Post.findById(comment.post);
    
    // Make sure user is comment author or post author
    if (
      comment.author.toString() !== req.user.id &&
      post.author.toString() !== req.user.id
    ) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to delete this comment'
      });
    }

    // Delete all replies to this comment
    await Comment.deleteMany({ parent: comment._id });

    // Update post comment count
    post.commentCount -= 1; // Decrease by 1 for the comment itself
    const repliesCount = await Comment.countDocuments({ parent: comment._id });
    post.commentCount -= repliesCount; // Decrease by the number of replies
    await post.save();

    await comment.remove();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Vote on comment
// @route   POST /api/comments/:id/vote
// @access  Private
exports.voteComment = async (req, res, next) => {
  try {
    const { value } = req.body;
    
    // Check if value is valid (1 for upvote, -1 for downvote)
    if (value !== 1 && value !== -1) {
      return res.status(400).json({
        success: false,
        error: 'Vote value must be 1 or -1'
      });
    }

    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      });
    }

    // Check if user has already voted on this comment
    const upvoted = comment.upvotes.includes(req.user.id);
    const downvoted = comment.downvotes.includes(req.user.id);

    // Remove existing vote if any
    if (upvoted) {
      comment.upvotes = comment.upvotes.filter(id => id.toString() !== req.user.id);
    }
    if (downvoted) {
      comment.downvotes = comment.downvotes.filter(id => id.toString() !== req.user.id);
    }

    // Add new vote if it's different from previous or if there was no previous vote
    if ((value === 1 && !upvoted) || (value === -1 && !downvoted)) {
      if (value === 1) {
        comment.upvotes.push(req.user.id);
      } else {
        comment.downvotes.push(req.user.id);
      }
    }

    // Update vote score
    comment.voteScore = comment.upvotes.length - comment.downvotes.length;

    await comment.save();

    res.status(200).json({
      success: true,
      data: {
        voteScore: comment.voteScore,
        upvotes: comment.upvotes.length,
        downvotes: comment.downvotes.length
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get replies to a comment
// @route   GET /api/comments/:id/replies
// @access  Public
exports.getCommentReplies = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      });
    }

    const replies = await Comment.find({ parent: req.params.id })
      .populate('author', 'username')
      .sort('-voteScore');

    res.status(200).json({
      success: true,
      count: replies.length,
      data: replies
    });
  } catch (err) {
    next(err);
  }
};
