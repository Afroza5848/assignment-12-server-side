require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'https://parcel-pro-server-ten.vercel.app',

    ],
}));
// middleware
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uc5r0l2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        //await client.connect();
        const userCollection = client.db('parcel-pro').collection('user')
        const bookingParcelsCollection = client.db('parcel-pro').collection('parcels')
        const reviewCollection = client.db('parcel-pro').collection('review')

        // jwt related api -----------------------
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2d' });
            res.send({ token })
        })
        // middlewares
        const verifyToken = (req, res, next) => {
            console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'forbidden access' });
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'forbidden access' });
                }
                req.decoded = decoded;
                next();
            })

        }
        // verify admin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: "forbidden access" });
            }
            next()
        }
        // verify deliverymen
        const verifyDeliverymen = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isDeliverymen = user?.role === 'deliverymen';
            if (!isDeliverymen) {
                return res.status(403).send({ message: "forbidden access" });
            }
            next()
        }
        // user related api------------------------
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const exitingUser = await userCollection.findOne(query);
            if (exitingUser) {
                return res.send({ message: 'user already exits', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })
        //  get use info from db-------for role----------
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const result = await userCollection.findOne({ email })
            res.send(result)
        })

        // booking parcels data save db-------------
        app.post('/parcels', verifyToken, async (req, res) => {
            const parcel = req.body;
            const result = await bookingParcelsCollection.insertOne(parcel);
            res.send(result);
        })
        // all parcels get----------only admin see ------------------
        app.get('/parcels', verifyToken, verifyAdmin, async (req, res) => {
            const parcels = req.body;
            const result = await bookingParcelsCollection.find(parcels).toArray();
            res.send(result)
        })

        //  single man parcels ------my parcels--------
        app.get('/parcels/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const result = await bookingParcelsCollection.find({ email }).toArray()
            res.send(result)
        })
        // get single parcel by id------------
        app.get('/parcel/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bookingParcelsCollection.findOne(query);
            res.send(result)
        })
        // updated single parcel----------------
        app.put('/bookingParcel/:id', verifyToken, async (req, res) => {
            const id = req.params.id
            const item = req.body;
            const query = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    phone: item.phone,
                    parcelType: item.parcelType,
                    parcelWeight: item.parcelWeight,
                    receiverName: item.receiverName,
                    receiverPhone: item.receiverPhone,
                    deliveryAddress: item.deliveryAddress,
                    deliveryDate: item.deliveryDate,
                    deliveryLatitude: item.deliveryLatitude,
                    deliveryLongitude: item.deliveryLongitude,
                    parcelPrice: item.parcelPrice,
                    bookingDate: Date.now()
                }
            }
            const result = await bookingParcelsCollection.updateOne(query, updatedDoc, options);
            res.send(result)
        })
        // delete booking parcel by login user
        app.patch('/parcels/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const status = req.body;
            const updatedDoc = {
                $set: { status: 'Canceled' }
            }
            const result = await bookingParcelsCollection.updateOne(query, updatedDoc);
            res.send(result)
        })
        // get all delivery men--------------only see admin----------
        app.get('/allDeliveryMens', verifyToken, verifyAdmin, async (req, res) => {
            const query = { role: 'deliverymen' }
            const result = await userCollection.find(query).toArray();
            res.send(result)
        })
        // parcels assign--------only admin see-----------------
        app.patch('/assignParcels/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) };
            const item = req.body;
            console.log('item', item);
            const updatedDoc = {

                $set: {
                    deliverymenId: item.deliverymenId, approximateDeliveryDate: item.approximateDeliveryDate,
                    status: 'On The Way'
                },

            }
            console.log(item);
            const result = await bookingParcelsCollection.updateOne(query, updatedDoc, { upsert: true });
            console.log(result);
            res.send(result)
        })
        // all parcels searching system---------only admin------------
        app.get('/allParcels', verifyToken, verifyAdmin, async (req, res) => {
            const startDate = req.query.startDate;
            const endDate = req.query.endDate;
            console.log(startDate, endDate);
            const query = { deliveryDate: { '$gte': startDate, '$lte': endDate } };
            console.log(query);
            const result = await bookingParcelsCollection.find(query).toArray();
            console.log(result);
            res.send(result)
        })
        // get all users in admin dashboard -----------only admin see---------
        app.get('/allUsers', verifyToken, verifyAdmin, async (req, res) => {
            const page = parseInt(req.query.page);
            const size = parseInt(req.query.size);
            const users = req.body;
            const result = await userCollection.find(users).skip(page * size).limit(size).toArray();
            res.send(result)
        })
        // book parcel and totalSpent update in user collection*******************
        app.patch('/updateUser', verifyToken, async (req, res) => {
            const parcel = req.body;
            const query = { email: parcel.email }
            const updatedDoc = {
                $inc: { parcelBooked: 1, totalSpent: parcel.parcelPrice }
            }
            const result = await userCollection.updateOne(query, updatedDoc);
            res.send(result)
        })
        // make delivery men -----------------only admin ---
        app.patch('/makeDeliverymen/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: { role: 'deliverymen' }
            }
            const result = await userCollection.updateOne(query, updatedDoc);
            res.send(result)
        })
        // make admin  -----------------only admin ---
        app.patch('/makeAdmin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: { role: 'admin' }
            }
            const result = await userCollection.updateOne(query, updatedDoc);
            res.send(result)
        })

        // submit review -----------------only user-------
        app.post('/review', verifyToken, async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        })
        // payment intent--------------------
        app.post('/create-payment-intent', verifyToken, async (req, res) => {
            const { parcelPrice } = req.body
            const amount = parseInt(parcelPrice * 100)
            console.log(amount)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })
        // total count of user for create pagination
        app.get('/totalCount', async (req, res) => {
            const count = await userCollection.estimatedDocumentCount();
            res.send({ count })
        })
        // average review for all deliverymen------------------only admin
        app.put('/average-review/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) };
            console.log(query);
            const rating = req.body.rating;
            console.log(rating);
            const updatedDoc = {
                $inc: { ratingNumber: 1, totalRating: rating }
            }
            const result = await userCollection.updateOne(query, updatedDoc, { upsert: true })
            console.log(result);
            res.send(result)
        })


        // $$$$$$$$$$$$$$$$$$$$$$$delivery men$$$$$$$$$$$$$$$$$$$$
        // my delivery list ----------------only delivery men see
        app.get('/myDeliveryList/:email', verifyToken, verifyDeliverymen, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const stringId = new ObjectId(user?._id).toString()
            const exist = { deliverymenId: stringId }
            const result = await bookingParcelsCollection.find(exist).toArray();
            res.send(result);
        })
        //  update status delivered from deliverymen--------------------only deliverymen see--
        app.patch('/updateDeliver/:id', verifyToken, verifyDeliverymen, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'Delivered'
                }
            }
            const result = await bookingParcelsCollection.updateOne(query, updatedDoc);
            res.send(result);
        })
        // number of delivered count---------------only deliverymen
        app.patch('/numDelivered/:email', verifyToken, verifyDeliverymen, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const updatedDoc = {
                $inc: { parcelDelivered: 1 }
            }
            const result = await userCollection.updateOne(query, updatedDoc);
            console.log(result);
            res.send(result);
        })
        //  update status canceled from deliverymen--------------------only deliverymen see--
        app.patch('/cancelParcel/:id', verifyToken, verifyDeliverymen, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'Canceled'
                }
            }
            const result = await bookingParcelsCollection.updateOne(query, updatedDoc);
            res.send(result);
        })
        // my review -------------------only delivery men
        app.get('/myReview/:email', verifyToken, verifyDeliverymen, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const stringId = new ObjectId(user?._id).toString()
            const exist = { deliverymenId: stringId }
            const result = await reviewCollection.find(exist).toArray();
            res.send(result);
        })
        // homepage-----------------------------------
        app.get('/total-all', async (req, res) => {
            const totalParcelBooked = await bookingParcelsCollection.estimatedDocumentCount();
            const totalParcelDelivered = await bookingParcelsCollection.countDocuments({ status: 'Delivered' });
            const totalUsers = await userCollection.estimatedDocumentCount();
            res.send({
                totalParcelBooked,
                totalParcelDelivered,
                totalUsers
            })
        })
        // top deliverymen------------------------
        app.get('/top-deliverymen', async (req, res) => {
            const deliveryMen = await userCollection.find({ role: 'deliverymen' }).toArray();
            // console.log(deliveryMen);
            const deliverymenData = deliveryMen.map(man => {
                if (man?.totalRating && man?.ratingNumber) {
                    const averageRating = (man?.totalRating / man?.ratingNumber).toFixed();
                    console.log(man.totalRating, man.ratingNumber);
                    return {
                        name: man.name,
                        image: man.image,
                        parcelDelivered: man.parcelDelivered,
                        averageRating
                    }
                }

            })
            const topDeliveryMen = deliverymenData.sort((a, b) => {
                if (b.parcelDelivered === a.parcelDelivered) {
                    return b.averageRating - a.averageRating;
                }
                return b.parcelDelivered - a.parcelDelivered;
            }).slice(0, 3);
            res.send(topDeliveryMen)
            console.log(topDeliveryMen);
        })

       


        // Send a ping to confirm a successful connection
        //await client.db("admin").command({ ping: 1 });
        //console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        //await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('parcel-pro server is running')
})
app.listen(port, () => {
    console.log(`parcel-pro server create on port:${port}`);
})