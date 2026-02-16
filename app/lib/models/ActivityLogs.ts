import mongoose, { mongo } from "mongoose";

const ActivityLogSchema = new mongoose.Schema({
    message: String,
    pokemonName: String,
    createdAt: {
        type: Date,
        default: Date.now,
        index: { expires: '60s' }
    }
});

export default mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);