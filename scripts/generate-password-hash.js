const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'mec123';
console.log(bcrypt.hashSync(password, 10));
