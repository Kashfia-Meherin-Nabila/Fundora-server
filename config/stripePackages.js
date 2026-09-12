const STRIPE_PACKAGES = {
  supporter_starter: {
    priceId: process.env.STRIPE_PRICE_STARTER,
    packageName: "Starter",
    credits: 100,
    amount: 10,
  },

  supporter_popular: {
    priceId: process.env.STRIPE_PRICE_POPULAR,
    packageName: "Popular",
    credits: 300,
    amount: 25,
  },

  supporter_value: {
    priceId: process.env.STRIPE_PRICE_VALUE,
    packageName: "Value",
    credits: 800,
    amount: 60,
  },

  supporter_premium: {
    priceId: process.env.STRIPE_PRICE_PREMIUM,
    packageName: "Premium",
    credits: 1500,
    amount: 110,
  },
};

module.exports = STRIPE_PACKAGES;