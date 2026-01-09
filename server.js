const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const https = require('https');
const zlib = require('zlib');

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files (your HTML page)
app.use(express.static('.'));

// Proxy endpoint
app.post('/api/proxy', (req, res) => {
    const { userid, password, request: requestXML, targetUrl, csrfToken } = req.body;

    console.log('=== Incoming Request ===');
    console.log('Proxying request to:', targetUrl);
    console.log('Username:', userid);
    console.log('CSRF Token value:', csrfToken);
    console.log('CSRF Token length:', csrfToken ? csrfToken.length : 0);
    console.log('Has CSRF token:', !!csrfToken);
    console.log('========================');

    const postData = new URLSearchParams({
        userid: userid,
        password: password,
        request: requestXML
    }).toString();

    const url = new URL(targetUrl);
    
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9'
    };

    // Add CSRF token if provided
    if (csrfToken) {
        headers['X-CSRF-TOKEN'] = csrfToken;
    }
    
    const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: headers
    };

    const proxyReq = https.request(options, (proxyRes) => {
        console.log('Response status:', proxyRes.statusCode);
        console.log('Content-Encoding:', proxyRes.headers['content-encoding']);
        
        let data = [];

        proxyRes.on('data', (chunk) => {
            data.push(chunk);
        });

        proxyRes.on('end', () => {
            const buffer = Buffer.concat(data);
            
            // Check if response is gzip compressed
            const encoding = proxyRes.headers['content-encoding'];
            
            if (encoding === 'gzip') {
                console.log('Decompressing gzip response...');
                zlib.gunzip(buffer, (err, decoded) => {
                    if (err) {
                        console.error('Gzip decompression error:', err);
                        res.status(500).send('Decompression Error: ' + err.message);
                    } else {
                        const decodedText = decoded.toString();
                        console.log('Response length:', decodedText.length);
                        res.status(proxyRes.statusCode).send(decodedText);
                    }
                });
            } else if (encoding === 'deflate') {
                console.log('Decompressing deflate response...');
                zlib.inflate(buffer, (err, decoded) => {
                    if (err) {
                        console.error('Deflate decompression error:', err);
                        res.status(500).send('Decompression Error: ' + err.message);
                    } else {
                        res.status(proxyRes.statusCode).send(decoded.toString());
                    }
                });
            } else {
                console.log('Sending uncompressed response...');
                res.status(proxyRes.statusCode).send(buffer.toString());
            }
        });
    });

    proxyReq.on('error', (error) => {
        console.error('Proxy request error:', error);
        res.status(500).send('Proxy Error: ' + error.message);
    });

    proxyReq.write(postData);
    proxyReq.end();
});

app.listen(PORT, () => {
    console.log(`Proxy server running at http://localhost:${PORT}`);
    console.log(`Open your browser to http://localhost:${PORT}/api-test.html`);
});