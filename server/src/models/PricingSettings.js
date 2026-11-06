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

    // "markup": Fishbowl list price x account markup. "fishbowl-rules": Fishbowl's own pricing rules.
    priceMode: { type: String, enum: ["markup", "fishbowl-rules"], default: "markup" },

    // Groups that sell at the Fishbowl price for every account (see config/fixedPriceGroups.js).
    // No default: a record that never saved groups uses the code's default list.
    fixedPriceGroups: {
      type: [
        new mongoose.Schema(
          {
            type: { type: String, enum: ["category", "maker"], required: true },
            value: { type: String, required: true },
            label: { type: String, default: "" },
            multiplier: { type: Number, default: 1, min: 0 },
          },
          { _id: false }
        ),
      ],
      default: undefined,
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