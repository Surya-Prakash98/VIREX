// ===== CONFIG =====
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true }
}));

// ===== DATABASE MODELS =====
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    city: { type: String, required: true },
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

const listingSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    category: { type: String, enum: ['Laptop', 'Phone', 'Camera', 'Console', 'Audio', 'Other'], required: true },
    description: { type: String, required: true },
    condition: { type: String, required: true },
    rentPricePerDay: { type: Number, required: true },
    deposit: { type: Number },
    city: { type: String, required: true },
    imageUrl: { type: String, required: true }, // can be a URL or a base64 string
    status: { type: String, enum: ['available', 'rented', 'sold'], default: 'available' },
}, { timestamps: true });
const Listing = mongoose.model('Listing', listingSchema);

const bookingSchema = new mongoose.Schema({
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    renter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalPrice: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'returned'], default: 'pending' },
}, { timestamps: true });
const Booking = mongoose.model('Booking', bookingSchema);

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendMail = async (to, subject, html) => {
    try {
        await transporter.sendMail({ from: '"VIREX" <noreply@virex.com>', to, subject, html });
        console.log('Email sent to', to);
    } catch (err) {
        console.error("Mail error:", err);
    }
};

// ===== VALIDATION HELPERS =====
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ===== MIDDLEWARE =====
const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    next();
};

// ===== AUTH ROUTES =====
app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password, phone, city } = req.body;
        if (!name || !email || !password || !phone || !city) return res.status(400).json({ error: 'All fields required' });
        if (password.length < 6) return res.status(400).json({ error: 'Password min 6 chars' });
        
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) return res.status(409).json({ error: 'Email already exists' });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashedPassword, phone, city });
        
        req.session.userId = user._id;
        
        sendMail(user.email, 'Welcome to VIREX', '<h1>Welcome to VIREX!</h1><p>Start renting and buying today.</p>');
        
        res.json({ 
            message: 'Signup successful', 
            token: `virex-token-${user._id}`, // Simulated login token for localStorage
            user: { id: user._id, name: user.name, email: user.email, city: user.city } 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
        
        req.session.userId = user._id;
        res.json({ 
            message: 'Login successful', 
            token: `virex-token-${user._id}`, // Simulated login token for localStorage
            user: { id: user._id, name: user.name, email: user.email, city: user.city } 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out' });
});

app.get('/api/me', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const user = await User.findById(req.session.userId).select('-password');
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ user });
});

// ===== LISTING ROUTES =====
app.get('/api/listings', async (req, res) => {
    try {
        const { search, category, city } = req.query;
        let query = {};
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { title: searchRegex },
                { description: searchRegex },
                { category: searchRegex }
            ];
        }
        if (category && category !== 'All') query.category = category;
        if (city) query.city = new RegExp(city, 'i');
        
        const listings = await Listing.find(query).populate('owner', 'name city').sort({ createdAt: -1 });
        res.json(listings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/listings/:id', async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
        const listing = await Listing.findById(req.params.id).populate('owner', 'name city');
        if (!listing) return res.status(404).json({ error: 'Listing not found' });
        res.json(listing);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/listings', requireAuth, async (req, res) => {
    try {
        const { title, category, description, condition, rentPricePerDay, deposit, city, imageUrl } = req.body;
        if (!title || !category || !description || !condition || !city || !imageUrl) return res.status(400).json({ error: 'Missing required fields' });
        if (!rentPricePerDay) return res.status(400).json({ error: 'Rent price required' });
        if (!imageUrl.startsWith('http') && !imageUrl.startsWith('data:image')) return res.status(400).json({ error: 'Invalid Image URL/Data' });

        const listing = await Listing.create({ ...req.body, owner: req.session.userId });
        res.json(listing);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/listings/:id', requireAuth, async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
        const listing = await Listing.findOneAndUpdate(
            { _id: req.params.id, owner: req.session.userId },
            req.body,
            { new: true }
        );
        if (!listing) return res.status(404).json({ error: 'Not found or not owner' });
        res.json(listing);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/listings/:id', requireAuth, async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
        const listing = await Listing.findOneAndDelete({ _id: req.params.id, owner: req.session.userId });
        if (!listing) return res.status(404).json({ error: 'Not found or not owner' });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/my/listings', requireAuth, async (req, res) => {
    try {
        const listings = await Listing.find({ owner: req.session.userId }).sort({ createdAt: -1 });
        res.json(listings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== BOOKING ROUTES =====
app.post('/api/bookings', requireAuth, async (req, res) => {
    try {
        const { listingId, startDate, endDate, totalPrice } = req.body;
        if (!isValidObjectId(listingId)) return res.status(400).json({ error: 'Invalid listing ID' });
        
        const listing = await Listing.findById(listingId);
        if (!listing) return res.status(404).json({ error: 'Listing not found' });
        if (listing.owner.toString() === req.session.userId) return res.status(400).json({ error: 'Cannot book own item' });
        if (listing.status !== 'available') return res.status(400).json({ error: 'Item not available' });
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end <= start) return res.status(400).json({ error: 'End date must be after start date' });

        const booking = await Booking.create({
            listing: listingId,
            renter: req.session.userId,
            owner: listing.owner,
            startDate: start,
            endDate: end,
            totalPrice
        });

        const owner = await User.findById(listing.owner);
        const renter = await User.findById(req.session.userId);
        sendMail(owner.email, 'New Request on VIREX', `<p>${renter.name} requested to rent your item "${listing.title}".</p><p>Total Price: Rs ${totalPrice}</p><p>Note: Product exchange is manual. Please contact the renter to arrange pickup/drop-off.</p>`);

        res.json(booking);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get('/api/my/bookings', requireAuth, async (req, res) => {
    try {
        const bookings = await Booking.find({ renter: req.session.userId }).populate('listing').sort({ createdAt: -1 });
        res.json(bookings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/my/requests', requireAuth, async (req, res) => {
    try {
        const requests = await Booking.find({ owner: req.session.userId }).populate('listing').populate('renter', 'name email').sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/bookings/:id/status', requireAuth, async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid ID' });
        const { status } = req.body;
        const booking = await Booking.findById(req.params.id).populate('renter listing');
        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        if (booking.owner.toString() === req.session.userId) {
            if (['approved', 'rejected'].includes(status)) booking.status = status;
        } else if (booking.renter._id.toString() === req.session.userId) {
            if (status === 'returned') booking.status = status;
        } else {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await booking.save();
        
        if (status === 'approved' || status === 'rejected') {
            sendMail(booking.renter.email, 'Request Update on VIREX', `<p>Your request for ${booking.listing.title} was ${status}.</p>`);
        }
        if (status === 'returned') {
            const owner = await User.findById(booking.owner);
            sendMail(owner.email, 'Item Returned on VIREX', `<p>Your item ${booking.listing.title} was marked as returned.</p>`);
        }
        
        res.json(booking);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ===== CONTACT ROUTE =====
app.post('/api/contact', requireAuth, async (req, res) => {
    try {
        const { listingId, message } = req.body;
        if (!isValidObjectId(listingId)) return res.status(400).json({ error: 'Invalid listing ID' });
        if (!message || message.trim().length < 10) return res.status(400).json({ error: 'Message must be at least 10 chars' });

        const listing = await Listing.findById(listingId).populate('owner');
        if (!listing) return res.status(404).json({ error: 'Listing not found' });

        const sender = await User.findById(req.session.userId);
        
        await sendMail(
            listing.owner.email,
            `Inquiry regarding ${listing.title} on VIREX`,
            `<p>User <strong>${sender.name}</strong> (${sender.email}) sent a message about <strong>${listing.title}</strong>:</p><blockquote>${message}</blockquote>`
        );

        res.json({ message: 'Owner has been emailed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== PAGE ROUTES =====
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/listing', (req, res) => res.sendFile(path.join(__dirname, 'public', 'listing.html')));

app.get('/api/*', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
});
app.get('*', (req, res) => {
    res.redirect('/');
});

// ===== SEED DATA =====
async function seedListings() {
    try {
        const count = await Listing.countDocuments();
        if (count === 0) {
            let dummyOwner = await User.findOne();
            if (!dummyOwner) {
                const hashedPassword = await bcrypt.hash('password123', 10);
                dummyOwner = await User.create({
                    name: 'Demo Seller',
                    email: 'demo@virex.com',
                    password: hashedPassword,
                    phone: '9876543210',
                    city: 'Mumbai'
                });
            }
            const sampleListings = [
                {
                    owner: dummyOwner._id,
                    title: 'MacBook Pro M2 16"',
                    category: 'Laptop',
                    description: 'High performance M2 Max 32GB RAM 1TB SSD. Perfect for video editing & coding.',
                    condition: 'Like New',
                    rentPricePerDay: 1500,
                    deposit: 5000,
                    city: 'Mumbai',
                    imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80',
                    status: 'available'
                },
                {
                    owner: dummyOwner._id,
                    title: 'Sony Alpha A7 IV Camera',
                    category: 'Camera',
                    description: 'Full-frame mirrorless camera with 28-70mm lens kit.',
                    condition: 'Excellent',
                    rentPricePerDay: 1200,
                    deposit: 4000,
                    city: 'Delhi',
                    imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80',
                    status: 'available'
                },
                {
                    owner: dummyOwner._id,
                    title: 'PlayStation 5 Console',
                    category: 'Console',
                    description: 'PS5 Disc Edition with 2 DualSense controllers and Spider-Man 2.',
                    condition: 'Good',
                    rentPricePerDay: 800,
                    deposit: 3000,
                    city: 'Bangalore',
                    imageUrl: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=600&q=80',
                    status: 'available'
                },
                {
                    owner: dummyOwner._id,
                    title: 'iPhone 15 Pro Max 256GB',
                    category: 'Phone',
                    description: 'Titanium Blue, battery health 99%. Includes box and original cable.',
                    condition: 'Like New',
                    rentPricePerDay: 850,
                    deposit: 2000,
                    city: 'Mumbai',
                    imageUrl: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=600&q=80',
                    status: 'available'
                },
                {
                    owner: dummyOwner._id,
                    title: 'Bose QC45 Headphones',
                    category: 'Audio',
                    description: 'Noise cancelling wireless headphones with incredible battery life.',
                    condition: 'Like New',
                    rentPricePerDay: 300,
                    deposit: 1000,
                    city: 'Pune',
                    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
                    status: 'available'
                }
            ];
            await Listing.insertMany(sampleListings);
            console.log('Sample listings seeded successfully');
        }
    } catch (err) {
        console.error('Seeding error:', err.message);
    }
}

// ===== START SERVER =====
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/virex').then(async () => {
    console.log('Connected to MongoDB virex');
    await seedListings();
    const PORT = process.env.PORT || 7000;
    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
        transporter.verify().then(() => {
            console.log('Nodemailer is ready to send emails');
        }).catch(err => {
            console.log('Nodemailer error:', err.message);
        });
    });
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use. Please free port ${PORT} or select another.`);
        } else {
            console.error('Server error:', err);
        }
    });
}).catch(err => {
    console.error('Failed to connect to MongoDB', err);
});
