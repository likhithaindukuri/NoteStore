const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notesSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        required: true,
    },
    domain: {
        type: String,
        required: true,
    },
    contributer_id: {
        type: String,
        required: true,
    },
    document_data: {
        type: Buffer,
        required: true, 
    }
}, { timestamps: true });

const notes = mongoose.model('notes', notesSchema);
module.exports = notes;
