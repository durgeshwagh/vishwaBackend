const express = require('express');
// Trigger restart for auth changes
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const authRoutes = require('./src/routes/auth');
const memberRoutes = require('./src/routes/members');
const fundRoutes = require('./src/routes/funds');
const eventRoutes = require('./src/routes/events');
const donationRoutes = require('./src/routes/donations');
const noticeRoutes = require('./src/routes/notices');
const boardRoutes = require('./src/routes/board');
const familyRoutes = require('./src/routes/family');
const adminRoutes = require('./src/routes/admin');
const locationRoutes = require('./src/routes/locations');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/community_app_db';

const compression = require('compression');
const helmet = require('helmet');

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Global Middleware for CORP
app.use((req, res, next) => {
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    next();
});

app.use(compression());
app.use(cors());
app.use(bodyParser.json());

// Swagger Configuration
// Swagger Configuration
// Swagger Configuration
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Community App API',
            version: '1.0.0',
            description: 'API Documentation for Community Management Application',
        },
        servers: [
            {
                url: 'http://localhost:3000',
            },
            {
                url: 'https://vishwa-backend-di8k.vercel.app',
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: ['./src/routes/*.js'], // Path to the API docs
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

app.get('/api-docs', (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Community App API Docs</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui.min.css" />
    <style>
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin: 0; background: #fafafa; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui-bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui-standalone-preset.min.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                spec: ${JSON.stringify(swaggerDocs)},
                dom_id: '#swagger-ui',
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                layout: "StandaloneLayout",
            });
        };
    </script>
</body>
</html>`;
    res.send(html);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/funds', fundRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/board', boardRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/locations', locationRoutes);
app.use('/uploads', express.static('uploads', {
  setHeaders: (res, path, stat) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

app.get('/', (req, res) => {
    res.send('Backend is running successfully!');
});

// Database Connection
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('MongoDB Connected');
        global.useMockDb = false;
    })
    .catch(err => {
        console.error('MongoDB Connection Failed:', err.message);
        console.log('Falling back to In-Memory Mock Database');
        global.useMockDb = true;
    });

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
