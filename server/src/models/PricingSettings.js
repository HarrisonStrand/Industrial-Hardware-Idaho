import mongoose from "mongoose";

const AccountRuleSchema = new mongoose.Schema(
  {
    label: { type: String, default: "" },
    multiplier: { type: Number, default: 1.0, min: 0 },
  },
  { _id: false }
);

const PricingSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "default",
      unique: true,
      index: true,
    },

    accountRules: {
      RETAIL: {
        type: AccountRuleSchema,
        default: () => ({ label: "Retail", multiplier: 1.0 }),
      },
      HOUSE: {
        type: AccountRuleSchema,
        default: () => ({ label: "House Account", multiplier: 1.0 }),
      },
      NET30: {
        type: AccountRuleSchema,
        default: () => ({ label: "Net 30", multiplier: 1.0 }),
      },
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("PricingSettings", PricingSettingsSchema);