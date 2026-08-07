import mongoose from "mongoose";

const CatalogGlobalSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "default",
      unique: true,
      index: true,
    },
    buildersEnabled: {
      type: Boolean,
      default: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model(
  "CatalogGlobalSetting",
  CatalogGlobalSettingSchema
);
