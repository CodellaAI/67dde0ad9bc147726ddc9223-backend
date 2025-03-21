
const mongoose = require('mongoose');
const slugify = require('slugify');

const CommunitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a community name'],
    unique: true,
    trim: true,
    minlength: [3, 'Community name must be at least 3 characters'],
    maxlength: [21, 'Community name cannot be more than 21 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Community name can only contain letters, numbers, and underscores']
  },
  description: {
    type: String,
    required: [true, 'Please provide a community description'],
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  slug: String,
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  moderators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  memberCount: {
    type: Number,
    default: 0
  },
  rules: [{
    title: {
      type: String,
      required: true
    },
    description: {
      type: String
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create slug from name
CommunitySchema.pre('save', function(next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// Update member count
CommunitySchema.pre('save', function(next) {
  this.memberCount = this.members.length;
  next();
});

// Virtual for community's posts
CommunitySchema.virtual('posts', {
  ref: 'Post',
  localField: '_id',
  foreignField: 'community',
  justOne: false
});

module.exports = mongoose.model('Community', CommunitySchema);
