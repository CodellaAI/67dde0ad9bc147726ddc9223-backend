
const Community = require('../models/Community');
const Post = require('../models/Post');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Get all communities
// @route   GET /api/communities
// @access  Public
exports.getCommunities = async (req, res, next) => {
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
    query = Community.find(JSON.parse(queryStr));

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
      query = query.sort('-memberCount');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Community.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const communities = await query;

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
      count: communities.length,
      pagination,
      data: communities
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get top communities
// @route   GET /api/communities/top
// @access  Public
exports.getTopCommunities = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 5;
    
    const communities = await Community.find()
      .sort('-memberCount')
      .limit(limit)
      .select('name description memberCount');

    res.status(200).json({
      success: true,
      count: communities.length,
      data: communities
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single community
// @route   GET /api/communities/:name
// @access  Public
exports.getCommunity = async (req, res, next) => {
  try {
    const community = await Community.findOne({ name: req.params.name })
      .populate('creator', 'username')
      .populate('moderators', 'username');

    if (!community) {
      return res.status(404).json({
        success: false,
        error: 'Community not found'
      });
    }

    res.status(200).json({
      success: true,
      data: community
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new community
// @route   POST /api/communities
// @access  Private
exports.createCommunity = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Check if community already exists
    const existingCommunity = await Community.findOne({ name: req.body.name });

    if (existingCommunity) {
      return res.status(400).json({
        success: false,
        error: 'Community with that name already exists'
      });
    }

    // Add user as creator and moderator
    req.body.creator = req.user.id;
    req.body.moderators = [req.user.id];
    req.body.members = [req.user.id];

    const community = await Community.create(req.body);

    res.status(201).json({
      success: true,
      data: community
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update community
// @route   PUT /api/communities/:name
// @access  Private
exports.updateCommunity = async (req, res, next) => {
  try {
    let community = await Community.findOne({ name: req.params.name });

    if (!community) {
      return res.status(404).json({
        success: false,
        error: 'Community not found'
      });
    }

    // Make sure user is a moderator
    if (!community.moderators.includes(req.user.id)) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to update this community'
      });
    }

    // Don't allow changing the name
    if (req.body.name) {
      delete req.body.name;
    }

    community = await Community.findByIdAndUpdate(community._id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: community
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Join community
// @route   POST /api/communities/:name/join
// @access  Private
exports.joinCommunity = async (req, res, next) => {
  try {
    const community = await Community.findOne({ name: req.params.name });

    if (!community) {
      return res.status(404).json({
        success: false,
        error: 'Community not found'
      });
    }

    // Check if user is already a member
    if (community.members.includes(req.user.id)) {
      return res.status(400).json({
        success: false,
        error: 'User is already a member of this community'
      });
    }

    // Add user to members
    community.members.push(req.user.id);
    await community.save();

    res.status(200).json({
      success: true,
      data: {
        memberCount: community.members.length
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Leave community
// @route   POST /api/communities/:name/leave
// @access  Private
exports.leaveCommunity = async (req, res, next) => {
  try {
    const community = await Community.findOne({ name: req.params.name });

    if (!community) {
      return res.status(404).json({
        success: false,
        error: 'Community not found'
      });
    }

    // Check if user is a member
    if (!community.members.includes(req.user.id)) {
      return res.status(400).json({
        success: false,
        error: 'User is not a member of this community'
      });
    }

    // Check if user is the creator
    if (community.creator.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Creator cannot leave the community'
      });
    }

    // Remove user from members
    community.members = community.members.filter(id => id.toString() !== req.user.id);
    
    // Remove user from moderators if they are one
    if (community.moderators.includes(req.user.id)) {
      community.moderators = community.moderators.filter(id => id.toString() !== req.user.id);
    }
    
    await community.save();

    res.status(200).json({
      success: true,
      data: {
        memberCount: community.members.length
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get community posts
// @route   GET /api/communities/:name/posts
// @access  Public
exports.getCommunityPosts = async (req, res, next) => {
  try {
    const community = await Community.findOne({ name: req.params.name });

    if (!community) {
      return res.status(404).json({
        success: false,
        error: 'Community not found'
      });
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Post.countDocuments({ community: community._id });

    // Sort options
    let sortOption = '-createdAt'; // Default: newest
    if (req.query.sort === 'top') {
      sortOption = '-voteScore';
    } else if (req.query.sort === 'hot') {
      // For 'hot', we could implement a more complex algorithm
      // For simplicity, we'll use a combination of votes and recency
      sortOption = '-voteScore -createdAt';
    }

    const posts = await Post.find({ community: community._id })
      .populate('author', 'username')
      .populate('community', 'name')
      .sort(sortOption)
      .skip(startIndex)
      .limit(limit);

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
