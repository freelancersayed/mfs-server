const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri =
  `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ehqhw1m.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  useNewUrlParser: true,
  useUnifiedTopology: true,
  socketTimeoutMS: 30000, // Adjust the socket timeout
  connectTimeoutMS: 30000, // Adjust the connection timeout
});

const jwtSecret = process.env.ACCESS_TOKEN_SECRET;

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db("mfsServer").collection("users");
    const loginCollection = client.db("mfsServer").collection("register");
    const sendMoneyCollection = client.db("mfsServer").collection("sendMoney");
    const cashInRequestsCollection = client
      .db("mfsServer")
      .collection("cashInRequests");

    // JWT Endpoint
    // app.post("/jwt", async (req, res) => {
    //   const user = req.body;
    //   const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    //     expiresIn: "1h",
    //   });
    //   res.send({ token });
    // });

    // JWT Middleware

    // const authenticateToken = (req, res, next) => {
    //   const token = req.header("x-auth-token");
    //   if (!token)
    //     return res.status(401).json({ msg: "No token, authorization denied" });

    //   try {
    //     const decoded = jwt.verify(token, jwtSecret);
    //     req.user = decoded.user;
    //     next();
    //   } catch (err) {
    //     res.status(401).json({ msg: "Token is not valid" });
    //   }
    // };

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h'
      });
      res.send({ token });
    });

    // middlewares
const verifyToken = (req, res, next) => {
  console.log('inside verify token', req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};



    app.get("/user", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
   

    app.post("/user", async (req, res) => {
      const { name, email, pin, number, status, role, balance } = req.body;

      // const query = { email: user.email };
      const user = await userCollection.findOne({
        email: email,
        number: number,
      });
      if (user) return res.status(400).json({ msg: "User already exists" });

      const salt = await bcrypt.genSalt(10);
      const hashedPin = await bcrypt.hash(pin, salt);

      const newUser = {
        name,
        email,
        pin: hashedPin,
        number,
        status,
        role,
        balance,
      };

      await userCollection.insertOne(newUser);
      const payload = { user: { id: newUser._id } };
      const token = jwt.sign(payload, jwtSecret, { expiresIn: "1h" });
      res.json({ token });
    });

    app.post("/agent", async (req, res) => {
      const { name, email, pin, number, status, role, balance } = req.body;

      // const query = { email: user.email };
      const user = await userCollection.findOne({
        email: email,
        number: number,
      });
      if (user) return res.status(400).json({ msg: "User already exists" });

      const salt = await bcrypt.genSalt(10);
      const hashedPin = await bcrypt.hash(pin, salt);

      const newUser = {
        name,
        email,
        pin: hashedPin,
        number,
        status,
        role,
        balance,
      };

      await userCollection.insertOne(newUser);

      const payload = { user: { id: newUser._id } };
      const token = jwt.sign(payload, jwtSecret, { expiresIn: "1h" });

      res.json({ token });
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/user-login/:contact", async (req, res) => {
      const { contact } = req.params; // এখানে req.params.contact থেকে contact প্রোপার্টি নেয়া হয়েছে
      try {
        const result = await userCollection.find({$or: [{ email: contact }, { number: contact }]}).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).send({ message: "An error occurred while fetching user" });
      }
    });

    app.get("/user-number/:number", async (req, res) => {
      const number = req.params.number;
      const query = { number: number };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/login", async (req, res) => {
      const { email, pin } = req.body;

      const user = await userCollection.findOne({
        $or: [{ email: email }, { number: email }]
      });
      if (!user) return res.status(400).json({ msg: "Invalid credentials" });

      const isMatch = await bcrypt.compare(pin, user.pin);
      if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

      const payload = { user: { id: user._id } };
      const token = jwt.sign(payload, jwtSecret, { expiresIn: "1h" });

      res.json({ token, status: user.status }); // Include status in the response
    });

    // All Users
    app.get("/all-users", verifyToken, async (req, res) => {
      try {
        const query = { role: "User", status: "Approved" };
        const result = await userCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.get("/all-users-pending", verifyToken, async (req, res) => {
      try {
        const query = { role: "User", status: "Pending" };
        const result = await userCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });
    app.get("/all-agent-pending", verifyToken, async (req, res) => {
      try {
        const query = { role: "Agent", status: "Pending" };
        const result = await userCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.get("/all-agent-pending", verifyToken,  async (req, res) => {
      try {
        const query = { role: "Agent", status: "Pending" };
        const result = await userCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });
    app.get("/all-user-block", verifyToken, async (req, res) => {
      try {
        const query = { status: "Block" };
        const result = await userCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // All Agents
    app.get("/all-agents", verifyToken, async (req, res) => {
      try {
        const query = { role: "Agent", status: "Approved" };
        const result = await userCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.put("/update-role/:id", async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;
      try {
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) }, // filter
          { $set: { role } } // update
        );
        if (result.modifiedCount === 1) {
          res.json({ message: "User role updated successfully" });
        } else {
          res.status(404).json({ message: "User not found" });
        }
      } catch (error) {
        res.status(500).json({ error: "Something went wrong" });
      }
    });

    app.put("/update-status/:id", async (req, res) => {
      const { id } = req.params;
      const { status, balance } = req.body; // Correct field is status, not role

      try {
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) }, // filter
          { $set: { status, balance } } // update
        );
        if (result.modifiedCount === 1) {
          res.json({ message: "User status updated successfully" });
        } else {
          res.status(404).json({ message: "User not found" });
        }
      } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).json({ error: "Something went wrong" });
      }
    });

    // Delete a material
    app.delete("/delete-user/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);

      if (result.deletedCount === 1) {
        res.status(200).json({
          message: "Material deleted successfully",
          deletedCount: result.deletedCount,
        });
      } else {
        res.status(404).json({ message: "Material not found" });
      }
    });

    // send money================================================
    app.get("/transections/:email", async (req, res) => {
      const { email } = req.params;
      try {
        const transactions = await sendMoneyCollection
          .find({
            $or: [{ senderEmail: email }, { receiverEmail: email }],
          })
          .toArray();
        res.json(transactions);
      } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({ error: "Something went wrong" });
      }
    });

    app.get("/trans", verifyToken, async (req, res) => {
      try {
        const transactions = await sendMoneyCollection.find().toArray();
        res.send(transactions);
      } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({ error: "Something went wrong" });
      }
    });

    app.post("/transections", async (req, res) => {
      const sendMoney = req.body;
      const result = await sendMoneyCollection.insertOne(sendMoney);
      res.json(result);
    });


    //   const { id } = req.params;
    //   const {balance, pin, email } = req.body;

    //   const users = await userCollection.findOne({ email: email });

    //   const isMatch = await bcrypt.compare(pin, users.pin);
    //   if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    //   try {
    //     const result = await userCollection.updateOne(
    //       { _id: new ObjectId(id) }, // filter
    //       { $set: { balance } } // update
    //     );
    //     if (result.modifiedCount === 1) {
    //       res.json({ message: "User status updated successfully" });
    //     } else {
    //       res.status(404).json({ message: "User not found" });
    //     }
    //   } catch (error) {
    //     console.error("Error updating status:", error);
    //     res.status(500).json({ error: "Something went wrong" });
    //   }
    // });

    app.put("/amount/:id", async (req, res) => {
      const { id } = req.params;
      const { balance, pin, email } = req.body;

      try {
        const user = await userCollection.findOne({ _id: new ObjectId(id) });

        if (!user) return res.status(404).json({ msg: "User not found" });

        if (pin && email) {
          const isMatch = await bcrypt.compare(pin, user.pin);
          if (!isMatch)
            return res.status(400).json({ msg: "Invalid credentials" });
        }

        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { balance } }
        );

        if (result.modifiedCount === 1) {
          res.json({ message: "Balance updated successfully" });
        } else {
          res.status(404).json({ message: "User not found" });
        }
      } catch (error) {
        console.error("Error updating balance:", error);
        res.status(500).json({ msg: "Internal server error" });
      }
    });

    app.get("/cashin", async (req, res) => {
      try {
        const transactions = await cashInRequestsCollection.find().toArray();
        res.send(transactions);
      } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({ error: "Something went wrong" });
      }
    });

    app.post("/cashin", async (req, res) => {
      const { amount, email, agentNumber } = req.body;

      try {
        const user = await userCollection.findOne({ email });
        if (!user)
          return res
            .status(400)
            .json({ success: false, message: "Invalid credentials" });

        const cashInRequest = {
          userId: user._id,
          userEmail: user.email,
          userNumber: user.number,
          amount,
          status: "Pending",
          agentNumber,
          createdAt: new Date(),
        };

        const result = await cashInRequestsCollection.insertOne(cashInRequest);
        res.json({ success: true, result });
      } catch (error) {
        console.error("Error processing cash in request:", error);
        res.status(500).json({ success: false, error: "Something went wrong" });
      }
    });

    app.get("/pending-cashin-requests/:number", async (req, res) => {
      const { number } = req.params;
      try {
        const pendingRequests = await cashInRequestsCollection
          .find({ agentNumber: number, status: "Pending" })
          .toArray();
        res.json(pendingRequests);
      } catch (error) {
        console.error("Error fetching pending cash-in requests:", error);
        res.status(500).json({ error: "Something went wrong" });
      }
    });

    app.put("/agent-cashin-approved/:id", async (req, res) => {
      const { id } = req.params;
      const { balance } = req.body; // Correct field is status, not role

      try {
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) }, // filter
          { $set: { balance, status: 'Approved' } } // update
        );
        if (result.modifiedCount === 1) {
          res.json({ message: "User status updated successfully" });
        } else {
          res.status(404).json({ message: "User not found" });
        }
      } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).json({ error: "Something went wrong" });
      }
    });

    app.put("/agent-cashin-reject/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body; // Correct field is status, not role

      try {
        const result = await cashInRequestsCollection.updateOne(
          { _id: new ObjectId(id) }, // filter
          { $set: { status } } // update
        );
        if (result.modifiedCount === 1) {
          res.json({ message: "User status updated successfully" });
        } else {
          res.status(404).json({ message: "User not found" });
        }
      } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).json({ error: "Something went wrong" });
      }
    });



    // search api
app.get('/search-users', async (req, res) => {
  const { searchTerm } = req.query;

  if (!searchTerm) {
    return res.status(400).json({ message: 'Search term is required' });
  }
  try {
    const query = {
      status: "Approved",
      role: "User",
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { role: { $regex: searchTerm, $options: 'i' } },
        { number: { $regex: searchTerm, $options: 'i' } }
      ]
    };
    const users = await userCollection.find(query).toArray();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'An error occurred while searching users', error });
  }
});

    // search api agent
    app.get('/search-agents', async (req, res) => {
      const { searchTerm } = req.query;
    
      if (!searchTerm) {
        return res.status(400).json({ message: 'Search term is required' });
      }
      try {
        const query = {
          status: "Approved",
          role: "Agent",
          $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } },
            { role: { $regex: searchTerm, $options: 'i' } },
            { number: { $regex: searchTerm, $options: 'i' } }
          ]
        };
        const users = await userCollection.find(query).toArray();
        res.json(users);
      } catch (error) {
        res.status(500).json({ message: 'An error occurred while searching agent', error });
      }
    });



    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from the mfs server!");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
