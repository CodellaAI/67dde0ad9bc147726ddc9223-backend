
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Community = require('../models/Community');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Get all posts
// @route   GET /api/posts
// @access  Public
exports.getPosts = async (req, res, next) => {
  try {
    let query;

    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit'];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

    // Finding resource
    query = Post.find(JSON.parse(queryStr))
      .populate('author', 'username')
      .populate('community', 'name');

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Post.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const posts = await query;

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: posts.length,
      pagination,
      data: posts
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single post
// @route   GET /api/posts/:id
// @access  Public
exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username')
      .populate('community', 'name');

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    res.status(200).json({
      success: true,
      data: post
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new post
// @route   POST /api/posts
// @access  Private
exports.createPost = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Add user to req.body
    req.body.author = req.user.id;

    // Check if community exists
    const community = await Community.findOne({ name: req.body.community });

    if (!community) {
      return res.status(404).json({
        success: false,
        error: 'Community not found'
      });
    }

    // Add community to req.body
    req.body.community = community._id;

    const post = await Post.create(req.body);

    // Populate author and community
    await post.populate('author', 'username');
    await post.populate('community', 'name');

    res.status(201).json({
      success: true,
      data: post
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update post
// @route   PUT /api/posts/:id
// @access  Private
exports.updatePost = async (req, res, next) => {
  try {
    let post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Make sure user is post author
    if (post.author.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to update this post'
      });
    }

    post = await Post.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: post
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Make sure user is post author or community moderator
    const community = await Community.findById(post.community);
    const isModerator = community.moderators.includes(req.user.id);

    if (post.author.toString() !== req.user.id && !isModerator) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to delete this post'
      });
    }

    // Delete all comments associated with the post
    await Comment.deleteMany({ post: req.params.id });

    await post.remove();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Vote on post
// @route   POST /api/posts/:id/vote
// @access  Private
exports.votePost = async (req, res, next) => {
  try {
    const { value } = req.body;
    
    // Check if value is valid (1 for upvote, -1 for downvote)
    if (value !== 1 && value !== -1) {
      return res.status(400).json({
        success: false,
        error: 'Vote value must be 1 or -1'
      });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Check if user has already voted on this post
    const upvoted = post.upvotes.includes(req.user.id);
    const downvoted = post.downvotes.includes(req.user.id);

    // Remove existing vote if any
    if (upvoted) {
      post.upvotes = post.upvotes.filter(id => id.toString() !== req.user.id);
    }
    if (downvoted) {
      post.downvotes = post.downvotes.filter(id => id.toString() !== req.user.id);
    }

    // Add new vote if it's different from previous or if there was no previous vote
    if ((value === 1 && !upvoted) || (value === -1 && !downvoted)) {
      if (value === 1) {
        post.upvotes.push(req.user.id);
      } else {
        post.downvotes.push(req.user.id);
      }
    }

    // Update vote score
    post.voteScore = post.upvotes.length - post.downvotes.length;

    await post.save();

    res.status(200).json({
      success: true,
      data: {
        voteScore: post.voteScore,
        upvotes: post.upvotes.length,
        downvotes: post.downvotes.length
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get comments for a post
// @route   GET /api/posts/:id/comments
// @access  Public
exports.getPostComments = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Get top-level comments (no parent)
    const comments = await Comment.find({ 
      post: req.params.id,
      parent: null
    })
      .populate('author', 'username')
      .sort('-voteScore');

    // Function to recursively get replies
    const getCommentWithReplies = async (comment) => {
      const replies = await Comment.find({ parent: comment._id })
        .populate('author', 'username')
        .sort('-voteScore');
      
      const repliesWithNestedReplies = [];
      
      for (const reply of replies) {
        const replyWithNestedReplies = reply.toObject();
        replyWithNestedReplies.replies = await getCommentWithReplies(reply);
        repliesWithNestedReplies.push(replyWithNestedReplies);
      }
      
      return repliesWithNestedReplies;
    };

    // Get all comments with their nested replies
    const commentsWithReplies = [];
    
    for (const comment of comments) {
      const commentWithReplies = comment.toObject();
      commentWithReplies.replies = await getCommentWithReplies(comment);
      commentsWithReplies.push(commentWithReplies);
    }

    res.status(200).json({
      success: true,
      count: commentsWithReplies.length,
      data: commentsWithReplies
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add comment to post
// @route   POST /api/posts/:id/comments
// @access  Private
exports.addComment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Create comment
    const comment = await Comment.create({
      content: req.body.content,
      author: req.user.id,
      post: req.params.id,
      parent: req.body.parent || null
    });

    // Populate author
    await comment.populate('author', 'username');

    // Update post comment count
    post.commentCount += 1;
    await post.save();

    res.status(201).json({
      success: true,
      data: comment
    });
  } catch (err) {
    next(err);
  }
};
