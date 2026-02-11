import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI variable missing in .env');
}

let cached = (global as any).mongooseCache;

if (!cached) {
  cached = (global as any).mongooseCache = { conn: null, promise: null };
}

export const connectToDb = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
    console.log('MongoDB connected to:', cached.conn.connection.name);
  } catch (error) {
    cached.promise = null; 
    console.error('MongoDB error:', error);
    throw error;
  }

  return cached.conn;
};