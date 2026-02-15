const operationType = {
    INSERT: 'insert',
    DELETE: 'delete'
}

function createInsertOperation(position, text, userId, version) {
    if (typeof position !== 'number' || typeof text !== 'string' || typeof userId !== 'string' || typeof version !== 'number') {
        throw new Error('Invalid parameters for insert operation');
    }
    return {
        type: operationType.INSERT,
        position,
        text,
        userId,
        version
    };
}

function createDeleteOperation(position, length, userId, version) {
    if (typeof position !== 'number' || typeof length !== 'number' || typeof userId !== 'string' || typeof version !== 'number') {
        throw new Error('Invalid parameters for delete operation');
    }
    return {
        type: operationType.DELETE,
        position,
        length,
        userId,
        version
    };
}

function isValidOperation(op) {
    if (!op || typeof op !== 'object' || !op.type || !op.userId || typeof op.version !== 'number') {
        return false;
    }
    if (op.type === operationType.INSERT) {
        return typeof op.position === 'number' && typeof op.text === 'string';
    }
    if (op.type === operationType.DELETE) {
        return typeof op.position === 'number' && typeof op.length === 'number';
    }
    return false;
}

function invertOperation(operation, content) {
    if (operation.type === OperationType.INSERT) {
        // Invert insert → delete what was inserted
        return createDelete(
            operation.position,
            operation.text.length,
            operation.userId,
            operation.version
        );
    }

    if (operation.type === OperationType.DELETE) {
        // Invert delete → insert what was deleted
        const deletedText = content.substring(
            operation.position,
            operation.position + operation.length
        );
        return createInsert(
            operation.position,
            deletedText,
            operation.userId,
            operation.version
        );
    }

    throw new Error('Invalid operation type');
}
function getOperationLength(operation) {
    if (operation.type === OperationType.INSERT) {
        return operation.text.length;
    }
    if (operation.type === OperationType.DELETE) {
        return -operation.length;
    }
    return 0;
}

function composeOperations(op1, op2) {
    // Can only compose operations from same user
    if (op1.userId !== op2.userId) {
        return null;
    }

    // Compose consecutive inserts at same position
    if (op1.type === OperationType.INSERT &&
        op2.type === OperationType.INSERT &&
        op1.position + op1.text.length === op2.position) {
        return createInsert(
            op1.position,
            op1.text + op2.text,
            op1.userId,
            op2.version
        );
    }

    // Compose consecutive deletes at same position
    if (op1.type === OperationType.DELETE &&
        op2.type === OperationType.DELETE &&
        op1.position === op2.position) {
        return createDelete(
            op1.position,
            op1.length + op2.length,
            op1.userId,
            op2.version
        );
    }

    return null;
}

module.exports = {
    operationType,
    createInsertOperation,
    createDeleteOperation,
    isValidOperation,
    invertOperation,
    getOperationLength,
    composeOperations
};
