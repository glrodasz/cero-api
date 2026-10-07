from dataclasses import replace
from pathlib import Path

from graphql import (
    EnumValueDefinitionNode,
    FieldDefinitionNode,
    GraphQLSchema,
    InputValueDefinitionNode,
    Node,
    TypeDefinitionNode,
    Visitor,
    build_schema,
    lexicographic_sort_schema,
    parse,
    print_ast,
    print_schema,
    visit,
)

from cero_graphql import schema

SHARED_SCHEMA = Path(__file__).parents[2] / "shared" / "graphql" / "schema.graphql"


DESCRIBED_NODES = (
    TypeDefinitionNode,
    FieldDefinitionNode,
    InputValueDefinitionNode,
    EnumValueDefinitionNode,
)


class WithoutDescriptions(Visitor):
    def enter(self, node: Node, *_: object) -> Node | None:
        if isinstance(node, DESCRIBED_NODES) and node.description is not None:
            return replace(node, description=None)
        return None


def canonical(graphql_schema: GraphQLSchema) -> str:
    """The schema printed in a stable order, without descriptions: only its shape is left."""
    document = parse(print_schema(lexicographic_sort_schema(graphql_schema)))
    return print_ast(visit(document, WithoutDescriptions()))


def test_matches_the_shared_schema() -> None:
    shared = build_schema(SHARED_SCHEMA.read_text())

    assert canonical(build_schema(schema.as_str())) == canonical(shared)
