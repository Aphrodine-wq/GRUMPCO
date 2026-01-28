import app, { appReady } from '../backend/src/index';

export default async function handler(req, res) {
    await appReady;
    return app(req, res);
}
