const mongoose = require('mongoose');

const logsSchema = new mongoose.Schema({
    user: {
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        password: {
            type: String,
            required: true
        },
        valid: {
            type: Boolean,
            default: false
        },
        date: {
            type: Date
        },
        admin: {
            type: Boolean,
            default: false
        },
        limit: {
            type: Number
        },
        certsent: {
            type: Number
        }
    }
});

const Logs = mongoose.model('Logs', logsSchema);

module.exports = Logs;