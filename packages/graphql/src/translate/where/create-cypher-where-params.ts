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

import type { GraphQLWhereArg, Context } from "../../types";
import type { Node } from "../../classes";
import mapToDbProperty from "../../utils/map-to-db-property";
import * as CypherBuilder from "../cypher-builder/CypherBuilder";
import { whereRegEx, WhereRegexGroups } from "./utils";
import { filterTruthy } from "../../utils/utils";
import { createComparisonOperation } from "./operations/create-comparison-operation";
import { createAggregateOperation } from "./operations/create-aggregate-operation";
import { createRelationOperation } from "./operations/create-relation-operation";
import { createConnectionOperation } from "./operations/create-connection-operation";
import { createGlobalNodeOperation } from "./operations/create-global-node-operation";

/** Translate a target node and GraphQL input into a Cypher operation */
export function createCypherWhereParams({
    targetElement,
    whereInput,
    context,
    node,
}: {
    targetElement: CypherBuilder.Node;
    whereInput: GraphQLWhereArg;
    context: Context;
    node: Node;
}): CypherBuilder.WhereParams | undefined {
    const mappedProperties = mapPropertiesToOperators({
        whereInput,
        targetElement,
        node,
        context,
    });

    return CypherBuilder.and(...mappedProperties);
}

export function mapPropertiesToOperators({
    whereInput,
    node,
    targetElement,
    context,
}: {
    whereInput: GraphQLWhereArg;
    node: Node;
    targetElement: CypherBuilder.Node | CypherBuilder.Variable;
    context: Context;
}): Array<CypherBuilder.ComparisonOp | CypherBuilder.BooleanOp | CypherBuilder.RawCypher | CypherBuilder.Exists> {
    const whereFields = Object.entries(whereInput);

    return filterTruthy(
        whereFields.map(([key, value]): CypherBuilder.WhereParams | undefined => {
            if (key === "OR") {
                const nested = value
                    .map((v) => {
                        return mapPropertiesToOperators({ whereInput: v, node, targetElement, context });
                    })
                    .flat();

                return CypherBuilder.or(...nested);
            }
            if (key === "AND") {
                const nested = value
                    .map((v) => {
                        return mapPropertiesToOperators({ whereInput: v, node, targetElement, context });
                    })
                    .flat();

                return CypherBuilder.and(...nested);
            }
            const fieldOperation = createComparisonOnProperty({ key, value, node, targetElement, context });

            return fieldOperation;
        })
    );
}

function createComparisonOnProperty({
    key,
    value,
    node,
    targetElement,
    context,
}: {
    key: string;
    value: any;
    node: Node;
    targetElement: CypherBuilder.Variable;
    context: Context;
}): CypherBuilder.ComparisonOp | CypherBuilder.BooleanOp | CypherBuilder.RawCypher | CypherBuilder.Exists | undefined {
    const match = whereRegEx.exec(key);

    const { prefix, fieldName, isAggregate, operator } = match?.groups as WhereRegexGroups;
    const isNot = operator?.startsWith("NOT") ?? false;
    const coalesceValue = [...node.primitiveFields, ...node.temporalFields, ...node.enumFields].find(
        (f) => fieldName === f.fieldName
    )?.coalesceValue as string | undefined;

    let dbFieldName = mapToDbProperty(node, fieldName);
    if (prefix) {
        dbFieldName = `${prefix}${dbFieldName}`;
    }
    if (node.isGlobalNode && key === "id") {
        return createGlobalNodeOperation({
            node,
            value,
            targetElement,
            coalesceValue,
        });
    }

    let propertyRef: CypherBuilder.PropertyRef | CypherBuilder.Function = targetElement.property(dbFieldName);
    if (coalesceValue) {
        propertyRef = CypherBuilder.coalesce(
            propertyRef as CypherBuilder.PropertyRef,
            new CypherBuilder.Literal(coalesceValue)
        );
    }

    const relationField = node.relationFields.find((x) => x.fieldName === fieldName);

    if (isAggregate) {
        if (!relationField) throw new Error("Aggregate filters must be on relationship fields");

        return createAggregateOperation({
            relationField,
            context,
            value,
            parentNode: targetElement as CypherBuilder.Node,
        });
    }

    if (relationField) {
        // Relation
        return createRelationOperation({
            relationField,
            context,
            parentNode: targetElement as CypherBuilder.Node,
            operator,
            value,
            isNot,
        });
    }

    const connectionField = node.connectionFields.find((x) => x.fieldName === fieldName);
    if (connectionField) {
        return createConnectionOperation({
            value,
            connectionField,
            context,
            parentNode: targetElement as CypherBuilder.Node,
            operator,
        });
    }

    if (value === null) {
        if (isNot) {
            return CypherBuilder.isNotNull(propertyRef);
        }
        return CypherBuilder.isNull(propertyRef);
    }

    const pointField = node.pointFields.find((x) => x.fieldName === fieldName);
    const durationField = node.primitiveFields.find((x) => x.fieldName === fieldName && x.typeMeta.name === "Duration");

    const comparisonOp = createComparisonOperation({
        propertyRefOrCoalesce: propertyRef,
        param: new CypherBuilder.Param(value),
        operator,
        durationField,
        pointField,
    });
    if (isNot) {
        return CypherBuilder.not(comparisonOp);
    }
    return comparisonOp;
}
