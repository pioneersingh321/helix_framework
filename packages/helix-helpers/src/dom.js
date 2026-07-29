export function createDomMethods(H) {
    return {
        scrollTo(target, behavior = 'smooth', block = 'start') {
            if (typeof target === 'string') {
                document.querySelector(target)?.scrollIntoView({ behavior, block });
            } else if (target instanceof Element) {
                target.scrollIntoView({ behavior, block });
            } else if (typeof target === 'number') {
                window.scrollTo({ top: target, behavior });
            } else {
                window.scrollTo({ top: 0, behavior });
            }
        },

        async copyToClipboard(text) {
            if (!H.isString(text)) return false;
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
                document.body.appendChild(ta);
                ta.select();
                try {
                    document.execCommand('copy');
                    return true;
                } catch {
                    return false;
                } finally {
                    document.body.removeChild(ta);
                }
            }
        },

        downloadFile(content, filename, type = 'text/plain') {
            const blob = new Blob([content], { type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 100);
        }
    };
}
