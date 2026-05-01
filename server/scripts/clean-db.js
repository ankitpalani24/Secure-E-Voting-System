const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Voter = require('./models/Voter');

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/voting')
  .then(async () => {
    // Find voters with no faceDescriptor or an empty faceDescriptor array
    const result = await Voter.deleteMany({
      $or: [
        { faceDescriptor: { $exists: false } },
        { faceDescriptor: { $size: 0 } },
        { faceDescriptor: null }
      ]
    });
    
    console.log(`Successfully deleted ${result.deletedCount} corrupted voter accounts lacking facial data.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error cleaning database:', err);
    process.exit(1);
  });
