import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, minlength: 1, maxlength: 60, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Absent for Google-only accounts (or after a Google link removes it — see spec 6).
    passwordHash: { type: String },
    googleId: { type: String, index: { unique: true, sparse: true } },
    avatarUrl: { type: String },
  },
  { timestamps: true }
);

/** Public shape — never leaks passwordHash or googleId. */
userSchema.methods.toPublic = function toPublic() {
  return {
    id: String(this._id),
    name: this.name,
    email: this.email,
    avatarUrl: this.avatarUrl || null,
  };
};

export const User = mongoose.models.User || mongoose.model('User', userSchema);
