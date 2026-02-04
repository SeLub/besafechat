const net = require('net');

function waitPort(port, host = 'localhost', timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    function checkPort() {
      const socket = new net.Socket();

      socket.setTimeout(1000);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        nextCheck();
      });

      socket.on('error', (err) => {
        socket.destroy();
        if (err.code === 'ECONNREFUSED') {
          // Port is available (not in use)
          resolve(false);
        } else {
          nextCheck();
        }
      });

      socket.connect(port, host);

      function nextCheck() {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for port check after ${timeout}ms`));
        } else {
          setTimeout(checkPort, 100);
        }
      }
    }

    checkPort();
  });
}

// Function to wait for a port to be free
async function waitForPortToBeFree(port, host = 'localhost', timeout = 10000) {
  const maxTime = Date.now() + timeout;

  while (Date.now() < maxTime) {
    try {
      const isPortUsed = await waitPort(port, host, 1000);
      
      if (!isPortUsed) {
        // Port is free, return
        return;
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.warn(`Error checking port: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  throw new Error(`Port ${port} is still in use after ${timeout}ms`);
}

if (require.main === module) {
 // Script is run directly
  const port = parseInt(process.argv[2]) || 4000;
  
  console.log(`Waiting for port ${port} to be free...`);
  
  waitForPortToBeFree(port)
    .then(() => {
      console.log(`Port ${port} is now free!`);
      process.exit(0);
    })
    .catch(err => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { waitPort, waitForPortToBeFree };