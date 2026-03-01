require('dotenv').config();
const { io } = require('socket.io-client');


async function runSocketTest() {
    console.log('🔗 Connecting to BidVault WebSocket Server...');
    
    // Connect to the socket server exactly like our Zustand store
    const socket = io('http://localhost:5001', {
        transports: ['websocket', 'polling']
    });

    const auctionId = '16ee170b-149f-4bf3-8e91-840dbee4ef37'; // Re-use the auction from the load test

    socket.on('connect', async () => {
        console.log(`✅ Connected with ID: ${socket.id}`);
        
        // 1. Join room
        socket.emit('join_auction', auctionId);
        console.log(`🎧 Joined room for Auction ${auctionId}. Listening for bids...`);

        // 3. Listen for broadcast
        socket.on('bid_placed', (data) => {
            console.log('\n=============================================');
            console.log('🚀 WEBSOCKET BROADCAST RECEIVED!');
            console.log('=============================================');
            console.log(`New Price: $${data.newPrice}`);
            console.log(`Bidder: ${data.bid.bidder_name}`);
            console.log(`Time: ${data.bid.placed_at}`);
            console.log('=============================================\n');
            
            console.log('✅ Real-time integration is fully operational!');
            process.exit(0);
        });

        // 2. Wait a second, then trigger an HTTP bid to test the server emit
        setTimeout(async () => {
            console.log('\n💸 Firing HTTP POST request to place a new Bid...');
            // Need a valid token. Reading the one we generated earlier:
            const testData = require('./k6_data.json');
            const token = testData.users[0].token;

            const res = await fetch(`http://localhost:5001/api/auctions/${auctionId}/bid`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    amount: 50.00, // Make sure it's higher than the $11 from earlier
                    idempotency_key: require('crypto').randomUUID()
                })
            });
            console.log(`   HTTP Response: ${res.status}`);
        }, 1000);
    });

    socket.on('connect_error', (err) => {
        console.log('❌ Connection Error:', err.message);
        process.exit(1);
    });

    setTimeout(() => {
        console.log('❌ Test Timed Out waiting for broadcast.');
        process.exit(1);
    }, 5000);
}

runSocketTest();
