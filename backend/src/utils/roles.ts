/**
 * Helpers pour la gestion du champ roles (JSON array de strings) sur le modèle Statut.
 * Ex. de valeur en base : '["estStock","estTransfert"]'
 */

export function parseRoles(rolesJson: string | null | undefined): string[] {
  if (!rolesJson) return []
  try {
    const parsed = JSON.parse(rolesJson)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function hasRole(rolesJson: string | null | undefined, role: string): boolean {
  return parseRoles(rolesJson).includes(role)
}

export function serializeRoles(roles: string[]): string {
  return JSON.stringify(Array.isArray(roles) ? roles : [])
}
