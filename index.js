const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const app = express();
const cors = require("cors");
const port = 5000;
require("dotenv").config();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db(process.env.AUTH_DB_NAME);
    const userCollection = db.collection("user");
    const campaignCollection = db.collection("campaigns");

    // registration user
    app.post("/api/users/register", async (req, res) => {
      try {
        const { name, email, photo, role } = req.body;

        // Validation
        if (!name || !email || !photo || !role) {
          return res.status(400).json({
            success: false,
            message: "Name, email, photo and role are required.",
          });
        }

        // Validate role
        if (role !== "Supporter" && role !== "Creator") {
          return res.status(400).json({
            success: false,
            message: "Role must be Supporter or Creator.",
          });
        }

        // Check existing user
        const existingUser = await userCollection.findOne({
          email: email.toLowerCase(),
        });

        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: "An account with this email already exists.",
          });
        }

        // Default credits
        const credits = role === "Supporter" ? 50 : 20;

        // Create user
        const newUser = {
          name,
          email: email.toLowerCase(),
          photo,
          role,
          credits,
          createdAt: new Date(),
        };

        const result = await userCollection.insertOne(newUser);

        res.status(201).json({
          success: true,
          message: "User registered successfully.",
          user: {
            _id: result.insertedId,
            name: newUser.name,
            email: newUser.email,
            photo: newUser.photo,
            role: newUser.role,
            credits: newUser.credits,
          },
        });
      } catch (error) {
        console.error("Registration error:", error);

        res.status(500).json({
          success: false,
          message: "Internal server error.",
        });
      }
    });

    // GET USER BY EMAIL

    app.get("/api/users/:email", async (req, res) => {
      try {
        const email = req.params.email.toLowerCase();

        const user = await userCollection.findOne({
          email,
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found.",
          });
        }

        res.json({
          success: true,
          user,
        });
      } catch (error) {
        console.error("Get user error:", error);

        res.status(500).json({
          success: false,
          message: "Internal server error.",
        });
      }
    });

    // ===============================
// Creator Dashboard Statistics
// ===============================
app.get("/api/creator/stats/:email", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();

    const campaigns = await campaignCollection
      .find({ creator_email: email })
      .toArray();

    const totalCampaigns = campaigns.length;

    const now = new Date();

    const activeCampaigns = campaigns.filter((campaign) => {
      return (
        campaign.status === "approved" &&
        new Date(campaign.deadline) > now
      );
    }).length;

    const totalRaised = campaigns.reduce((total, campaign) => {
      return total + Number(campaign.raised_amount || 0);
    }, 0);

    res.status(200).json({
      totalCampaigns,
      activeCampaigns,
      totalRaised,
    });
  } catch (error) {
    console.error("Creator stats error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch creator statistics.",
    });
  }
});



    // ===============================
// ADD NEW CAMPAIGN
// ===============================
app.get("/api/campaigns/creator/:email", async (req, res) => {
  try {
    const email = req.params.email;

    const campaigns = await campaignCollection
      .find({ creator_email: email })
      .sort({ deadline: -1 })
      .toArray();

    res.status(200).send(campaigns);
  } catch (error) {
    console.error("Get creator campaigns error:", error);

    res.status(500).send({
      message: "Failed to fetch campaigns",
      error: error.message,
    });
  }
});



app.post("/api/campaigns", async (req, res) => {
  try {
    const {
      campaign_title,
      campaign_story,
      category,
      funding_goal,
      minimum_contribution,
      deadline,
      reward_info,
      campaign_image_url,

      creator_email,
      creator_name,

      raised_amount,
      status,
    } = req.body;


    // =========================
    // Validation
    // =========================

    if (
      !campaign_title ||
      !campaign_story ||
      !category ||
      !funding_goal ||
      !minimum_contribution ||
      !deadline ||
      !reward_info ||
      !campaign_image_url ||
      !creator_email ||
      !creator_name
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields are required.",
      });
    }


    if (
      Number(minimum_contribution) >
      Number(funding_goal)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Minimum contribution cannot be greater than funding goal.",
      });
    }


    // =========================
    // Check Creator
    // =========================

    const creator = await userCollection.findOne({
      email: creator_email,
    });


    if (!creator) {
      return res.status(404).json({
        success: false,
        message: "Creator not found.",
      });
    }


    if (creator.role !== "Creator") {
      return res.status(403).json({
        success: false,
        message:
          "Only creators can create campaigns.",
      });
    }


    // =========================
    // Create Campaign
    // =========================

    const campaign = {
      campaign_title,
      campaign_story,
      category,

      funding_goal: Number(funding_goal),

      minimum_contribution: Number(
        minimum_contribution
      ),

      deadline: new Date(deadline),

      reward_info,

      campaign_image_url,

      creator_email,
      creator_name,

      raised_amount:
        Number(raised_amount) || 0,

      status: "pending",

      createdAt: new Date(),
      updatedAt: new Date(),
    };


    const result =
      await campaignCollection.insertOne(
        campaign
      );


    res.status(201).json({
      success: true,

      message:
        "Campaign created successfully and is waiting for admin approval.",

      campaignId: result.insertedId,
    });

  } catch (error) {

    console.error(
      "Add campaign error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to create campaign.",
      error: error.message,
    });
  }
});


app.get("/api/creator/pending-contributions/:email", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();

    const contributions = await db
      .collection("contributions")
      .find({
        creator_email: email,
        status: "pending",
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(contributions);
  } catch (error) {
    console.error("Pending contributions error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch pending contributions.",
    });
  }
});

// ===============================
// UPDATE CAMPAIGN
// ===============================


const { ObjectId } = require("mongodb");

app.put("/api/campaigns/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      campaign_title,
      campaign_story,
      category,
      funding_goal,
      minimum_contribution,
      deadline,
      reward_info,
      campaign_image_url,
    } = req.body;

    if (
      !campaign_title ||
      !campaign_story ||
      !category ||
      !funding_goal ||
      !minimum_contribution ||
      !deadline ||
      !reward_info ||
      !campaign_image_url
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields are required.",
      });
    }

    const result = await campaignCollection.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          campaign_title,
          campaign_story,
          category,
          funding_goal: Number(funding_goal),
          minimum_contribution: Number(
            minimum_contribution
          ),
          deadline: new Date(deadline),
          reward_info,
          campaign_image_url,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Campaign updated successfully.",
    });

  } catch (error) {
    console.error("Update campaign error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update campaign.",
      error: error.message,
    });
  }
});

// ===============================
// DELETE CAMPAIGN
// ===============================
app.delete("/api/campaigns/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid campaign ID.",
      });
    }

    const result = await campaignCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Campaign deleted successfully.",
    });
  } catch (error) {
    console.error("Delete campaign error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete campaign.",
      error: error.message,
    });
  }
});

// ===============================
// CREATE WITHDRAWAL
// ===============================
app.post("/api/withdrawals", async (req, res) => {
  try {
    const {
      creator_email,
      creator_name,
      withdrawal_credit,
      withdrawal_amount,
      payment_system,
      account_number,
      withdraw_date,
    } = req.body;

    if (
      !creator_email ||
      !creator_name ||
      !withdrawal_credit ||
      !withdrawal_amount ||
      !payment_system ||
      !account_number
    ) {
      return res.status(400).json({
        success: false,
        message: "All withdrawal fields are required.",
      });
    }

    const credits = Number(withdrawal_credit);

    // Minimum 200 credits
    if (credits < 200) {
      return res.status(400).json({
        success: false,
        message: "Minimum withdrawal is 200 credits.",
      });
    }

    // Must be multiple of 20
    if (credits % 20 !== 0) {
      return res.status(400).json({
        success: false,
        message: "Withdrawal credits must be a multiple of 20.",
      });
    }

    // Get creator
    const creator = await userCollection.findOne({
      email: creator_email,
    });

    if (!creator) {
      return res.status(404).json({
        success: false,
        message: "Creator not found.",
      });
    }

    if (creator.role !== "Creator") {
      return res.status(403).json({
        success: false,
        message: "Only creators can withdraw.",
      });
    }

    // Check credits
    if (Number(creator.credits) < credits) {
      return res.status(400).json({
        success: false,
        message: "Insufficient credits.",
      });
    }

    // Calculate amount from backend
    const amount = credits / 20;

    const withdrawal = {
      creator_email,
      creator_name,
      withdrawal_credit: credits,
      withdrawal_amount: amount,
      payment_system,
      account_number,
      withdraw_date: new Date(withdraw_date || Date.now()),
      status: "pending",
      createdAt: new Date(),
    };

    // Save withdrawal
    const result = await db
      .collection("withdrawals")
      .insertOne(withdrawal);

    // Deduct credits immediately
    await userCollection.updateOne(
      { email: creator_email },
      {
        $inc: {
          credits: -credits,
        },
      }
    );

    res.status(201).json({
      success: true,
      message: "Withdrawal request submitted successfully.",
      withdrawalId: result.insertedId,
    });
  } catch (error) {
    console.error("Withdrawal error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create withdrawal.",
      error: error.message,
    });
  }
});

// Get creator payment history
app.get("/api/withdrawals/creator/:email", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();

    const withdrawals = await db
      .collection("withdrawals")
      .find({ creator_email: email })
      .sort({ withdraw_date: -1 })
      .toArray();

    res.status(200).json(withdrawals);
  } catch (error) {
    console.error("Payment history error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch payment history.",
    });
  }
});

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
