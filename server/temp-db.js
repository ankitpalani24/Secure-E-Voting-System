const mongoose = require('mongoose');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const Voter = require('./models/Voter');

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/voting')
  .then(async () => {
    const voters = await Voter.find();
    let out = `Total voters: ${voters.length}\n`;
    voters.forEach(v => {
      out += `Email: ${v.email}, Descriptor length: ${v.faceDescriptor ? v.faceDescriptor.length : 'undefined'}, hasVoted: ${v.hasVoted}\n`;
    });
    fs.writeFileSync('db_output_clean.txt', out, 'utf8');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
