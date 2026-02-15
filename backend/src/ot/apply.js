const transform = require('./transform');

function apply(content, operation) {
    if (operation.type === 'insert') {
        // Validate text type first
        if (typeof operation.text !== 'string') {
            throw new Error('Invalid text for insert operation');
        }

        // Skip empty inserts
        if (operation.text.length === 0) {
            return content;
        }

        // Validate position bounds
        if (operation.position < 0 || operation.position > content.length) {
            throw new Error(`Invalid insert position: ${operation.position}`);
        }

        // Insert text at position
        return content.slice(0, operation.position) + operation.text + content.slice(operation.position);
    }

    if (operation.type === 'delete') {
        // Validate position and length
        if (operation.position < 0 || operation.position > content.length) {
            throw new Error(`Invalid delete position: ${operation.position}`);
        }

        if (operation.length < 0 || operation.position + operation.length > content.length) {
            throw new Error(`Invalid delete range: position ${operation.position}, length ${operation.length}`);
        }

        // Delete length characters starting at position
        return content.slice(0, operation.position) + content.slice(operation.position + operation.length);
    }

    throw new Error(`Unknown operation type: ${operation.type}`);
}

module.exports = apply;