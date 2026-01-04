const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= FIREBASE ADMIN ================= */
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString(
  'utf8'
);
const serviceAccount = JSON.parse(decoded);
// const serviceAccount = require('./fureverly_adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

/* ================= MONGODB ================= */
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@fureverlydb.o2jukph.mongodb.net/?appName=fureverlyDB`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let petCollection, orderCollection, userCollection;

/* ================= FIREBASE AUTH ================= */
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ message: 'Invalid Firebase token' });
  }
};

/* ================= ADMIN CHECK ================= */
const verifyAdmin = async (req, res, next) => {
  const user = await userCollection.findOne({ email: req.user.email });
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

/* ================= ROOT ================= */
app.get('/', (req, res) => {
  res.send('Fureverly Server running with Firebase Auth');
});

/* ================= MAIN ================= */
async function run() {
  try {
    await client.connect();
    const db = client.db('fureverlyDB');

    petCollection = db.collection('petCollection');
    orderCollection = db.collection('orderCollection');
    userCollection = db.collection('userCollection');

    console.log('MongoDB connected');

    /* ================= USER SAVE ================= */
    app.post('/users', verifyFirebaseToken, async (req, res) => {
      const email = req.user.email;
      const { name, photoURL } = req.body;

      const exists = await userCollection.findOne({ email });
      if (exists) return res.json({ message: 'User already exists' });

      await userCollection.insertOne({
        name: name || '',
        email,
        profileImage: photoURL || '',
        role: 'user',
        isActive: true,
        createdAt: new Date(),
      });

      res.status(201).json({ message: 'User saved' });
    });

    /* ================= USER ROLE (SELF) ================= */
    app.get('/user/role', verifyFirebaseToken, async (req, res) => {
      const user = await userCollection.findOne({ email: req.user.email });
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json({ role: user.role });
    });

    /* ================= USER PROFILE ================= */
    app.get('/user/profile', verifyFirebaseToken, async (req, res) => {
      const user = await userCollection.findOne({ email: req.user.email });
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user);
    });

    app.put('/user/profile', verifyFirebaseToken, async (req, res) => {
      const { name, profileImage, phone, address } = req.body;

      await userCollection.updateOne(
        { email: req.user.email },
        {
          $set: {
            name,
            profileImage,
            phone,
            address,
            updatedAt: new Date(),
          },
        }
      );

      res.json({ message: 'Profile updated successfully' });
    });

    /* ================= USER ROLE MANAGEMENT (ADMIN USE) ================= */
    app.get('/users/:email', verifyFirebaseToken, async (req, res) => {
      const { email } = req.params;
      const user = await userCollection.findOne({ email });
      if (!user) return res.status(404).json({ message: 'User not found' });

      res.json({
        role: user.role,
        isActive: user.isActive,
      });
    });

    app.patch(
      '/admin/users/:email/role',
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        const { email } = req.params;
        const { role } = req.body;

        if (!['user', 'admin'].includes(role)) {
          return res.status(400).json({ message: 'Invalid role' });
        }

        await userCollection.updateOne(
          { email },
          { $set: { role, updatedAt: new Date() } }
        );

        res.json({ message: 'Role updated successfully' });
      }
    );

    /* ================= PRODUCTS ================= */
    app.get('/products', async (req, res) => {
      res.json(await petCollection.find().toArray());
    });

    app.get('/products/latest', async (req, res) => {
      res.json(
        await petCollection.find().sort({ createdAt: -1 }).limit(6).toArray()
      );
    });

    app.post('/products', verifyFirebaseToken, async (req, res) => {
      const product = {
        ...req.body,
        email: req.user.email,
        createdBy: req.user.uid,
        status: 'Available',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      res.status(201).json(await petCollection.insertOne(product));
    });

    app.put('/products/:id', verifyFirebaseToken, async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id))
        return res.status(400).json({ message: 'Invalid ID' });

      const product = await petCollection.findOne({ _id: new ObjectId(id) });
      if (!product) return res.status(404).json({ message: 'Not found' });
      if (product.email !== req.user.email)
        return res.status(403).json({ message: 'Forbidden' });

      await petCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...req.body, updatedAt: new Date() } }
      );

      res.json({ message: 'Updated' });
    });

    app.delete('/products/:id', verifyFirebaseToken, async (req, res) => {
      const product = await petCollection.findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!product) return res.status(404).json({ message: 'Not found' });
      if (product.email !== req.user.email)
        return res.status(403).json({ message: 'Forbidden' });

      await petCollection.deleteOne({ _id: product._id });
      res.json({ message: 'Deleted' });
    });

    /* ================= ORDERS ================= */
    app.post('/orders', verifyFirebaseToken, async (req, res) => {
      const order = {
        ...req.body,
        email: req.user.email,
        status: 'Pending',
        createdAt: new Date(),
      };

      res.status(201).json(await orderCollection.insertOne(order));
    });

    app.get('/orders', verifyFirebaseToken, async (req, res) => {
      res.json(await orderCollection.find({ email: req.user.email }).toArray());
    });

    /* ================= DASHBOARD STATS ================= */
    app.get('/dashboard/stats', verifyFirebaseToken, async (req, res) => {
      const user = await userCollection.findOne({ email: req.user.email });

      if (user.role === 'admin') {
        res.json({
          totalUsers: await userCollection.countDocuments(),
          totalProducts: await petCollection.countDocuments(),
          totalOrders: await orderCollection.countDocuments(),
          pendingOrders: await orderCollection.countDocuments({
            status: 'Pending',
          }),
        });
      } else {
        res.json({
          userProducts: await petCollection.countDocuments({
            email: req.user.email,
          }),
          userOrders: await orderCollection.countDocuments({
            email: req.user.email,
          }),
          pendingOrders: await orderCollection.countDocuments({
            email: req.user.email,
            status: 'Pending',
          }),
        });
      }
    });

    /* ================= ADMIN STATISTICS ================= */
    app.get(
      '/admin/stats',
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        res.json({
          totalUsers: await userCollection.countDocuments(),
          totalProducts: await petCollection.countDocuments(),
          totalOrders: await orderCollection.countDocuments(),
          activeProducts: await petCollection.countDocuments({
            status: 'Available',
          }),
        });
      }
    );

    /* ================= ADMIN LIST ================= */
    app.get(
      '/admin/users',
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        res.json(await userCollection.find().toArray());
      }
    );

    app.get(
      '/admin/orders',
      verifyFirebaseToken,
      verifyAdmin,
      async (req, res) => {
        res.json(await orderCollection.find().toArray());
      }
    );
  } catch (error) {
    console.error(error);
  }
}

run();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
