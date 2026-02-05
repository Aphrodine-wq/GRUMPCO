export async function startShipMode(
  request: ShipStartRequest,
): Promise<ShipSession> {
  const db = getDatabase();
  const sessionId = `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // If localPath is provided, use it as workspaceRoot if not already set
  if (request.localPath && request.preferences && !request.preferences.workspaceRoot) {
    request.preferences.workspaceRoot = request.localPath;
  }

  const session: ShipSession = {
    id: sessionId,
    projectDescription: request.projectDescription,
    phase: "design",
    status: "initializing",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: request.userId,
    preferences: request.preferences,
    projectId: request.projectId,
    projectName: request.projectName,
    repoOrg: request.repoOrg,
    deploymentTarget: request.deploymentTarget,
    localPath: request.localPath,
  };

  await db.saveShipSession(session);
  logger.info({ sessionId, localPath: request.localPath }, "SHIP mode session started");

  return session;
}
