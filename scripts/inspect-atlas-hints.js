const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const db = require('../backend/config/database');

async function checkAtlas() {
  await db.init();
  const c = db.getChallenges().find(c => c.challengeId === 'CRY-000000-00000-C001' || c.id === 'CRY-000000-00000-C001');
  console.log('\n--- MONGODB ATLAS CHALLENGE RECORD ---');
  console.log('ID:', c.id, 'ChallengeID:', c.challengeId, 'PublicRouteId:', c.publicRouteId);
  console.log('Title:', c.title);
  console.log('Hints count in challenge:', c.hints ? c.hints.length : 0);
  console.log(JSON.stringify(c.hints, null, 2));

  if (db.mongoDb) {
    const rawDoc = await db.mongoDb.collection('challenges').findOne({
      $or: [{ id: c.id }, { challengeId: c.challengeId }]
    });
    console.log('\n--- DIRECT ATLAS COLLECTION "challenges" ---');
    console.log('MongoDB _id:', rawDoc._id);
    console.log('Direct Atlas hints count:', rawDoc.hints ? rawDoc.hints.length : 0);
    console.log(JSON.stringify(rawDoc.hints, null, 2));

    const hintsCollectionDocs = await db.mongoDb.collection('challenge_hints').find({
      $or: [{ challenge_id: c.id }, { challengeId: c.id }]
    }).toArray();
    console.log('\n--- DIRECT ATLAS COLLECTION "challenge_hints" ---');
    console.log('Total in challenge_hints collection:', hintsCollectionDocs.length);
    console.log(JSON.stringify(hintsCollectionDocs.map(h => ({
      id: h.id,
      text: h.content || h.text,
      cost: h.cost,
      order: h.order_index || h.order,
      enabled: h.enabled
    })), null, 2));

    const reveals = await db.mongoDb.collection('hint_reveals').find({
      $or: [{ challenge_id: c.id }, { challengeId: c.id }]
    }).toArray();
    console.log('\n--- DIRECT ATLAS COLLECTION "hint_reveals" ---');
    console.log('Total reveals recorded:', reveals.length);
    console.log(JSON.stringify(reveals.map(r => ({
      id: r.id,
      hint_id: r.hint_id,
      user_id: r.user_id,
      team_id: r.team_id,
      points_deducted: r.points_deducted,
      revealed_at: r.revealed_at
    })), null, 2));
  }
  process.exit(0);
}

checkAtlas().catch(e => {
  console.error(e);
  process.exit(1);
});
