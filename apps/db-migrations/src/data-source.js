"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const dotenv_1 = require("dotenv");
const typeorm_1 = require("typeorm");
(0, dotenv_1.config)();
const url = process.env.DATABASE_URL;
if (!url) {
    throw new Error('DATABASE_URL es requerido');
}
exports.default = new typeorm_1.DataSource({
    type: 'postgres',
    url,
    synchronize: false,
    ssl: (process.env.DATABASE_SSL ?? 'false') === 'true' ? { rejectUnauthorized: false } : false,
    migrations: ['src/migrations/*.ts'],
});
