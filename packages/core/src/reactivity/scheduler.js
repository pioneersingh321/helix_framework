import {
    queue,
    queueSet,
    preFlushQueue,
    postFlushQueue,
    idleQueue,
    idleCallbackId,
    setIdleCallbackId,
    isFlushing,
    setIsFlushing,
    isFlushPending,
    setIsFlushPending,
    MAX_FLUSH,
    resolvedPromise,
    handleError,
    trace,
    logger
} from '../shared/shared.js';

export function queueJob(job, priority = 0) {
    if (!queueSet.has(job)) {
        queueSet.add(job);
        job.priority = priority;
        const id = job.id || 0;
        let inserted = false;
        for (let i = 0; i < queue.length; i++) {
            const existing = queue[i];
            const existingP = existing.priority || 0;
            const existingId = existing.id || 0;
            if (priority > existingP || (priority === existingP && id < existingId)) {
                queue.splice(i, 0, job);
                inserted = true;
                break;
            }
        }
        if (!inserted) queue.push(job);
        queueFlush();
    }
}

export function queuePreFlushCb(cb) {
    preFlushQueue.push(cb);
    queueFlush();
}

export function queuePostFlushCb(cb) {
    postFlushQueue.push(cb);
    queueFlush();
}

export function queueIdleJob(job) {
    idleQueue.push(job);
    if (idleCallbackId === null && typeof requestIdleCallback !== "undefined") {
        const cbId = requestIdleCallback(() => {
            setIdleCallbackId(null);
            while (idleQueue.length) {
                const idleJob = idleQueue.shift();
                try { idleJob(); } catch (e) { handleError(e, "idle job"); }
            }
        }, { timeout: 2000 });
        setIdleCallbackId(cbId);
    }
}

let queueFlushPaused = false;

export function pauseQueueFlush() {
    queueFlushPaused = true;
}

export function resumeQueueFlush() {
    queueFlushPaused = false;
    if (queue.length || preFlushQueue.length || postFlushQueue.length) {
        flushJobs();
    }
}

function queueFlush() {
    if (!isFlushPending && !queueFlushPaused) {
        setIsFlushPending(true);
        resolvedPromise.then(flushJobs);
    }
}

export function flushJobs() {
    if (isFlushing) {
        setIsFlushPending(true);
        return;
    }
    setIsFlushPending(false);
    setIsFlushing(true);
    let flushCount = 0;
    let recursionDepth = 0;
    const MAX_RECURSION = 100;
    try {
        do {
            if (++flushCount > MAX_FLUSH) {
                logger.error("Infinite update loop detected (exceeded MAX_FLUSH)", "scheduler");
                break;
            }
            if (++recursionDepth > MAX_RECURSION) {
                logger.error("Scheduler recursion depth exceeded", "scheduler");
                break;
            }
            trace("Batch Flush", "flush", () => {
                for (let i = 0; i < preFlushQueue.length; i++) preFlushQueue[i]();
                preFlushQueue.length = 0;
                const high = [];
                const normal = [];
                const low = [];
                for (let i = 0; i < queue.length; i++) {
                    const job = queue[i];
                    if (job) {
                        const prio = job.priority || 0;
                        if (prio >= 10) high.push(job);
                        else if (prio >= 0) normal.push(job);
                        else low.push(job);
                    }
                }
                queue.length = 0;
                queueSet.clear();

                for (let i = 0; i < high.length; i++) high[i]();
                for (let i = 0; i < normal.length; i++) normal[i]();
                for (let i = 0; i < low.length; i++) low[i]();

                for (let i = 0; i < postFlushQueue.length; i++) postFlushQueue[i]();
                postFlushQueue.length = 0;
            });
        } while (queue.length || preFlushQueue.length || postFlushQueue.length);
    } finally {
        setIsFlushing(false);
        if (isFlushPending) {
            setIsFlushPending(false);
            flushJobs();
        }
    }
}
