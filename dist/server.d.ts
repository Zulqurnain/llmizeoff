import express from "express";
import { ServerConfig } from "./types";
export declare function createServer(config?: ServerConfig): express.Application;
/** Start the server directly (used as cPanel startup file) */
export declare function startServer(config?: ServerConfig): Promise<void>;
//# sourceMappingURL=server.d.ts.map