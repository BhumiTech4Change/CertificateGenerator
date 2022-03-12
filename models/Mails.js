const mongoose = require('mongoose')

const mailsSchema = new mongoose.Schema({
    mailID: {},
    mails: [{ }]
})

const Mails = mongoose.model('Mails', mailsSchema);

module.exports = Mails;