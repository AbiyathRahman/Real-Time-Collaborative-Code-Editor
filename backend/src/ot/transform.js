function transform(op1, op2) {
    // Both are inserts
    if (op1.type === 'insert' && op2.type === 'insert') {
        if (op1.position < op2.position) {
            // op1 inserts before op2 → shift op2 right
            return { ...op2, position: op2.position + op1.text.length };
        } else if (op1.position > op2.position) {
            // op1 inserts after op2 → no change
            return op2;
        } else {
            // Same position: use userId as tie-breaker (lower ID wins)
            return op1.userId < op2.userId
                ? { ...op2, position: op2.position + op1.text.length }
                : op2;
        }
    }

    // op1 insert, op2 delete
    if (op1.type === 'insert' && op2.type === 'delete') {
        if (op1.position <= op2.position) {
            // op1 inserts before or at delete position → shift delete right
            return { ...op2, position: op2.position + op1.text.length };
        }
        // op1 inserts after delete position → no change
        return op2;
    }

    // op1 delete, op2 insert
    if (op1.type === 'delete' && op2.type === 'insert') {
        if (op2.position >= op1.position + op1.length) {
            // op2 inserts after delete range → shift left
            return { ...op2, position: op2.position - op1.length };
        } else if (op2.position > op1.position) {
            // op2 inserts in deleted range → move to start of delete
            return { ...op2, position: op1.position };
        }
        // op2 inserts before delete → no change
        return op2;
    }

    // Both are deletes
    if (op1.type === 'delete' && op2.type === 'delete') {
        const op1End = op1.position + op1.length;
        const op2End = op2.position + op2.length;

        if (op2.position >= op1End) {
            // op2 entirely after op1 → shift left
            return { ...op2, position: op2.position - op1.length };
        } else if (op2End <= op1.position) {
            // op2 entirely before op1 → no change
            return op2;
        } else {
            // Overlapping deletes → adjust both position and length
            const newPosition = Math.min(op1.position, op2.position);
            const newEnd = Math.max(op1End, op2End);
            const newLength = Math.max(0, newEnd - newPosition - op1.length);
            return { ...op2, position: newPosition, length: newLength };
        }
    }

    return op2;
}

module.exports = {
    transform
};