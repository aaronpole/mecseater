const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'mec@123_p0p_th3_ball00n';
console.log(bcrypt.hashSync(password, 10));
