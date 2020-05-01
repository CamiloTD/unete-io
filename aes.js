const crypto = require('crypto');

module.exports = {
    encrypt (data, key) {
        let cipher = crypto.createCipher('aes-256-cbc', key);
    
        return Buffer.concat([cipher.update(data), cipher.final()]);
    },
    
    decrypt (data, key) {
        let cipher = crypto.createDecipher('aes-256-cbc', key);
    
        return Buffer.concat([cipher.update(data), cipher.final()]);
    }
}