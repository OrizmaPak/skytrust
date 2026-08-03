function parsePermissions(value) {
  if (!value || typeof value !== 'string') return [];

  return value
    .split('|')
    .map((permission) => permission.trim())
    .filter(Boolean);
}

function resolveEffectivePermissions(user = {}, rolePermissions = user.permissions) {
  if (user.role === 'SUPERADMIN') return 'SUPERADMIN';

  const effectivePermissions = new Set(parsePermissions(rolePermissions));
  const userPermissions = parsePermissions(user.userpermissions);

  userPermissions.forEach((permission) => {
    if (permission.startsWith('__')) {
      effectivePermissions.delete(permission.slice(2));
    } else {
      effectivePermissions.add(permission);
    }
  });

  return Array.from(effectivePermissions).join('|');
}

function hasPermission(user = {}, permission) {
  if (!permission) return true;
  if (user.role === 'SUPERADMIN') return true;

  return parsePermissions(user.permissions).includes(permission);
}

module.exports = {
  parsePermissions,
  resolveEffectivePermissions,
  hasPermission
};
