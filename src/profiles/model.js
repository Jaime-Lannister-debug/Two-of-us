// 个人昵称与头像的校验。
export function profileName(person, index) {
  return person?.nickname?.trim() || ['A', 'B'][index] || '我们';
}
export function profileAvatar(value) {
  return typeof value === 'string' &&
    value.length <= 60000 &&
    /^data:image\/(jpeg|png|webp);base64,/.test(value)
    ? value
    : '';
}
