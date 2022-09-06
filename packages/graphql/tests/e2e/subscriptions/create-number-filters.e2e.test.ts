/*
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [http://neo4j.com]
 *
 * This file is part of Neo4j.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Driver } from "neo4j-driver";
import type { Response } from "supertest";
import supertest from "supertest";
import { Neo4jGraphQL } from "../../../src/classes";
import { generateUniqueType } from "../../utils/graphql-types";
import type { TestGraphQLServer } from "../setup/apollo-server";
import { ApolloTestServer } from "../setup/apollo-server";
import { TestSubscriptionsPlugin } from "../../utils/TestSubscriptionPlugin";
import { WebSocketTestClient } from "../setup/ws-client";
import Neo4j from "../setup/neo4j";

describe("Create Subscription with filters valid of number types (Int, Float, BigInt)", () => {
    let neo4j: Neo4j;
    let driver: Driver;

    const typeMovie = generateUniqueType("Movie");

    let server: TestGraphQLServer;
    let wsClient: WebSocketTestClient;

    beforeAll(async () => {
        const typeDefs = `
         type ${typeMovie} {
            title: String
            releasedIn: Int
            averageRating: Float
            fileSize: BigInt
         }
         `;

        neo4j = new Neo4j();
        driver = await neo4j.getDriver();

        const neoSchema = new Neo4jGraphQL({
            typeDefs,
            driver,
            config: {
                driverConfig: {
                    database: neo4j.getIntegrationDatabaseName(),
                },
            },
            plugins: {
                subscriptions: new TestSubscriptionsPlugin(),
            },
        });

        server = new ApolloTestServer(neoSchema);
        await server.start();
    });

    beforeEach(() => {
        wsClient = new WebSocketTestClient(server.wsPath);
    });

    afterEach(async () => {
        await wsClient.close();
    });

    afterAll(async () => {
        await server.close();
        await driver.close();
    });

    test("subscription with where filter _LT for Int 1 result", async () => {
        await wsClient.subscribe(`
            subscription {
                ${typeMovie.operations.subscribe.created}(where: { releasedIn_LT: 2000 }) {
                    ${typeMovie.operations.subscribe.payload.created} {
                        title
                    }
                }
            }
        `);

        await createMovie({ title: "movie1", releasedIn: 2000 });
        await createMovie({ title: "movie2", releasedIn: 1999 });

        expect(wsClient.errors).toEqual([]);
        expect(wsClient.events).toEqual([
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie2" },
                },
            },
        ]);
    });
    test("subscription with where filter _LTE for Int multiple result", async () => {
        await wsClient.subscribe(`
            subscription {
                ${typeMovie.operations.subscribe.created}(where: { releasedIn_LTE: 2000 }) {
                    ${typeMovie.operations.subscribe.payload.created} {
                        title
                    }
                }
            }
        `);

        await createMovie({ title: "movie1", releasedIn: 2000 });
        await createMovie({ title: "movie2", releasedIn: 1999 });
        await createMovie({ title: "movie3", releasedIn: 2999 });

        expect(wsClient.errors).toEqual([]);
        expect(wsClient.events).toIncludeSameMembers([
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie1" },
                },
            },
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie2" },
                },
            },
        ]);
    });
    test("subscription with where filter _GT for Int 1 result", async () => {
        await wsClient.subscribe(`
            subscription {
                ${typeMovie.operations.subscribe.created}(where: { releasedIn_GT: 2000 }) {
                    ${typeMovie.operations.subscribe.payload.created} {
                        title
                    }
                }
            }
        `);

        await createMovie({ title: "movie1", releasedIn: 2020 });
        await createMovie({ title: "movie2", releasedIn: 2000 });

        expect(wsClient.errors).toEqual([]);
        expect(wsClient.events).toEqual([
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie1" },
                },
            },
        ]);
    });
    test("subscription with where filter _GTE for Int multiple result", async () => {
        await wsClient.subscribe(`
            subscription {
                ${typeMovie.operations.subscribe.created}(where: { releasedIn_GTE: 2000 }) {
                    ${typeMovie.operations.subscribe.payload.created} {
                        title
                    }
                }
            }
        `);

        await createMovie({ title: "movie1", releasedIn: 1920 });
        await createMovie({ title: "movie2", releasedIn: 2000 });
        await createMovie({ title: "movie3", releasedIn: 2030 });

        expect(wsClient.errors).toEqual([]);
        expect(wsClient.events).toIncludeSameMembers([
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie2" },
                },
            },
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie3" },
                },
            },
        ]);
    });

    test("subscription with where filter _LT for Float 1 result", async () => {
        await wsClient.subscribe(`
            subscription {
                ${typeMovie.operations.subscribe.created}(where: { averageRating_LT: 8 }) {
                    ${typeMovie.operations.subscribe.payload.created} {
                        title
                    }
                }
            }
        `);

        await createMovie({ title: "movie1", averageRating: 8.0 });
        await createMovie({ title: "movie2", averageRating: 5 });

        expect(wsClient.errors).toEqual([]);
        expect(wsClient.events).toEqual([
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie2" },
                },
            },
        ]);
    });
    test("subscription with where filter _LTE for Float multiple result", async () => {
        await wsClient.subscribe(`
            subscription {
                ${typeMovie.operations.subscribe.created}(where: { averageRating_LTE: 7 }) {
                    ${typeMovie.operations.subscribe.payload.created} {
                        title
                    }
                }
            }
        `);

        await createMovie({ title: "movie1", averageRating: 6.7 });
        await createMovie({ title: "movie2", averageRating: 7.0 });
        await createMovie({ title: "movie3", averageRating: 7.1 });

        expect(wsClient.errors).toEqual([]);
        expect(wsClient.events).toIncludeSameMembers([
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie1" },
                },
            },
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie2" },
                },
            },
        ]);
    });
    test("subscription with where filter _GT for Float 1 result", async () => {
        await wsClient.subscribe(`
            subscription {
                ${typeMovie.operations.subscribe.created}(where: { averageRating_GT: 7.9 }) {
                    ${typeMovie.operations.subscribe.payload.created} {
                        title
                    }
                }
            }
        `);

        await createMovie({ title: "movie1", averageRating: 8 });
        await createMovie({ title: "movie2", averageRating: 7.9 });

        expect(wsClient.errors).toEqual([]);
        expect(wsClient.events).toEqual([
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie1" },
                },
            },
        ]);
    });
    test("subscription with where filter _GTE for Float multiple results", async () => {
        await wsClient.subscribe(`
            subscription {
                ${typeMovie.operations.subscribe.created}(where: { averageRating_GTE: 5 }) {
                    ${typeMovie.operations.subscribe.payload.created} {
                        title
                    }
                }
            }
        `);

        await createMovie({ title: "movie1", averageRating: 4.1 });
        await createMovie({ title: "movie2", averageRating: 5.3 });
        await createMovie({ title: "movie3", averageRating: 6.2 });

        expect(wsClient.errors).toEqual([]);
        expect(wsClient.events).toIncludeSameMembers([
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie2" },
                },
            },
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie3" },
                },
            },
        ]);
    });
    test("subscription with where filter _GTE for Float multiple results no decimals", async () => {
        await wsClient.subscribe(`
            subscription {
                ${typeMovie.operations.subscribe.created}(where: { averageRating_GTE: 4.2 }) {
                    ${typeMovie.operations.subscribe.payload.created} {
                        title
                    }
                }
            }
        `);

        await createMovie({ title: "movie1", averageRating: 4.1 });
        await createMovie({ title: "movie2", averageRating: 5 });
        await createMovie({ title: "movie3", averageRating: 6.2 });

        expect(wsClient.errors).toEqual([]);
        expect(wsClient.events).toIncludeSameMembers([
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie2" },
                },
            },
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie3" },
                },
            },
        ]);
    });

    test("subscription with where filter _LT for BigInt 1 result", async () => {
        const bigInts = {
            s: "9223372036854775608",
            m: "9223372036854775708",
            l: "9223372036854775807",
        };
        await wsClient.subscribe(`
            subscription {
                ${typeMovie.operations.subscribe.created}(where: { fileSize_LT: ${bigInts.m} }) {
                    ${typeMovie.operations.subscribe.payload.created} {
                        title
                    }
                }
            }
        `);

        await createMovie({ title: "movie1", fileSize: bigInts.m });
        await createMovie({ title: "movie2", fileSize: bigInts.s });

        expect(wsClient.errors).toEqual([]);
        expect(wsClient.events).toEqual([
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie2" },
                },
            },
        ]);
    });
    test("subscription with where filter _LTE for BigInt multiple result", async () => {
        const bigInts = {
            s: "9223372036854775608",
            m: "9223372036854775708",
            l: "9223372036854775807",
        };
        await wsClient.subscribe(`
            subscription {
                ${typeMovie.operations.subscribe.created}(where: { fileSize_LTE: ${bigInts.m} }) {
                    ${typeMovie.operations.subscribe.payload.created} {
                        title
                    }
                }
            }
        `);

        await createMovie({ title: "movie1", fileSize: bigInts.s });
        await createMovie({ title: "movie2", fileSize: bigInts.m });
        await createMovie({ title: "movie3", fileSize: bigInts.l });

        expect(wsClient.errors).toEqual([]);
        expect(wsClient.events).toIncludeSameMembers([
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie1" },
                },
            },
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie2" },
                },
            },
        ]);
    });
    test("subscription with where filter _GT for BigInt 1 result", async () => {
        const bigInts = {
            m: "9223372036854775708",
            l: "9223372036854775710",
        };
        await wsClient.subscribe(`
            subscription {
                ${typeMovie.operations.subscribe.created}(where: { fileSize_GT: ${bigInts.m} }) {
                    ${typeMovie.operations.subscribe.payload.created} {
                        title
                    }
                }
            }
        `);

        await createMovie({ title: "movie1", fileSize: bigInts.l });
        await createMovie({ title: "movie2", fileSize: bigInts.m });

        expect(wsClient.errors).toEqual([]);
        expect(wsClient.events).toEqual([
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie1" },
                },
            },
        ]);
    });
    test("subscription with where filter _GTE for BigInt multiple result", async () => {
        const bigInts = {
            s: "9223372036854775608",
            m: "9223372036854775708",
            l: "9223372036854775807",
        };
        await wsClient.subscribe(`
            subscription {
                ${typeMovie.operations.subscribe.created}(where: { fileSize_GTE: ${bigInts.m} }) {
                    ${typeMovie.operations.subscribe.payload.created} {
                        title
                    }
                }
            }
        `);

        await createMovie({ title: "movie1", fileSize: bigInts.s });
        await createMovie({ title: "movie2", fileSize: bigInts.m });
        await createMovie({ title: "movie3", fileSize: bigInts.l });

        expect(wsClient.errors).toEqual([]);
        expect(wsClient.events).toIncludeSameMembers([
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie2" },
                },
            },
            {
                [typeMovie.operations.subscribe.created]: {
                    [typeMovie.operations.subscribe.payload.created]: { title: "movie3" },
                },
            },
        ]);
    });

    async function createMovie({
        title,
        releasedIn = 2022,
        averageRating = 9.5,
        fileSize = "2147483647",
    }): Promise<Response> {
        const result = await supertest(server.path)
            .post("")
            .send({
                query: `
                    mutation {
                        ${typeMovie.operations.create}(input: [{ title: "${title}", releasedIn: ${releasedIn}, averageRating: ${averageRating}, fileSize: "${fileSize}" }]) {
                            ${typeMovie.plural} {
                                title
                                releasedIn
                                averageRating
                                fileSize
                            }
                        }
                    }
                `,
            })
            .expect(200);
        return result;
    }
});
