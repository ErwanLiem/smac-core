export function getPermissions() {
  const utilisateur = JSON.parse(localStorage.getItem('utilisateur') || 'null')
  const isAdmin = utilisateur?.role?.code === 'ADMIN'
  const permissions: string[] = utilisateur?.permissions ?? []

  return {
    isAdmin,
    peutVoir:      (path: string) => isAdmin || permissions.includes(`${path}:view`),
    peutEditer:    (path: string) => isAdmin || permissions.includes(`${path}:edit`),
    peutSupprimer: (path: string) => isAdmin || permissions.includes(`${path}:delete`),
    peutCreer:     (path: string) => isAdmin || permissions.includes(`${path}:edit`),
  }
}
