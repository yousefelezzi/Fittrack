/**
 * Daily water goal in ml: the user's own, or about 35 ml per kg of body weight
 * (rounded to 50 ml), or 2,500 ml when the weight isn't known.
 */
function waterGoal(user) {
  if (user?.waterGoal) return user.waterGoal;
  if (user?.weight) return Math.round((user.weight * 35) / 50) * 50;
  return 2500;
}

module.exports = { waterGoal };
