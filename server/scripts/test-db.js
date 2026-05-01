require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB Connected Successfully for test!');
        console.log('MONGO_URI works!');
        process.exit(0);
    })
    .catch(err => {
        console.log('❌ MongoDB Connection Error:', err.message);
        process.exit(1);
    });

