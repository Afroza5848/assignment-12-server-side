const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
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
        await client.connect();
        const userCollection = client.db('parcel-pro').collection('user')
        const bookingParcelsCollection = client.db('parcel-pro').collection('parcels')

        // jwt related api ---------------------
         app.post('/jwt', async(req,res) => {
            const user = req.body;
            const token = jwt.sign(user , process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
            res.send({ token })
        })
        // middlewares
        const verifyToken = (req,res,next) => {
            console.log('inside verify token',req.headers.authorization);
            if(!req.headers.authorization){
                return res.status(401).send({message: 'forbidden access'});
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if(err){
                    return res.status(401).send({message: 'forbidden access'}); 
                }
                req.decoded = decoded;
                next();
            })
           
        }
        // user related api------------------------
        app.post('/users', async(req, res) => {
            const user = req.body;
            const query = {email: user.email}
            const exitingUser = await userCollection.findOne(query);
            if(exitingUser){
                return res.send({message: 'user already exits', insertedId: null})
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        })
        //  get use info from db-----------------
        app.get('/users/:email', async(req,res) => {
            const email = req.params.email;
            const result = await userCollection.findOne({ email })
            res.send(result)
        })

        // booking parcels data save db-------------
        app.post('/parcels', async(req,res) => {
            const parcel = req.body;
            const result = await bookingParcelsCollection.insertOne(parcel);
            res.send(result);
        })
        //  single man parcels --------------
        app.get('/parcels/:email', async(req,res) => {
            const email = req.params.email
            const result = await bookingParcelsCollection.find({ email }).toArray()
            res.send(result)
        })










        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
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