import type { LessonDefinition, SessionDefinition, LessonContent, ProjectBrief, CodeSnippet } from './types';
import { topic } from './topics';

/* ── Compact authoring helpers ─────────────────────────────────────────
   Every lesson is expanded into the mandatory 13-part teaching format by
   buildLesson(). The authored material is real: each topic carries a plain
   English explanation, an analogy, concrete steps, a true statement, a
   misconception and a common mistake. Nothing is a one-line definition. */

const L = (
  slug: string,
  title: string,
  why: string,
  topicKeys: string[],
  exerciseTitle: string,
  exerciseBrief: string,
  recap: string[],
): LessonDefinition => ({
  slug, title, why, minutes: 12 + topicKeys.length * 7, topics: topicKeys,
  exercise: {
    title: exerciseTitle,
    brief: exerciseBrief,
    steps: topicKeys.map((k, i) => `${i + 1}. ${topic(k).steps[i % topic(k).steps.length]}`),
    successChecks: topicKeys.map(k => topic(k).truth),
  },
  recap,
});

const P = (
  title: string, brief: string,
  requirements: string[], acceptanceCriteria: string[], stretchGoals: string[],
): ProjectBrief => ({ title, brief, requirements, acceptanceCriteria, stretchGoals });

/** Expand a lesson definition into the 13 required sections. */
export function buildLesson(def: LessonDefinition): LessonContent {
  const topics = def.topics.map(topic);
  const snippets: CodeSnippet[] = topics.flatMap(t => t.code
    ? [{ language: t.code.language, title: t.code.title, code: t.code.code,
        lineNotes: t.code.notes.map(([line, note]) => ({ line, note })) }]
    : []);

  return {
    title: def.title,
    whatYouWillLearn: topics.map(t => t.title),
    whyItMatters: def.why,
    explanation: topics.map(t => ({
      heading: t.title,
      paragraphs: [
        t.plain,
        t.analogy ? `Think of it this way: ${t.analogy}` : '',
        `A concrete way to start: ${t.steps[0]}`,
        `A believable but wrong idea is: "${t.myth}" ${t.truth}`,
      ].filter(Boolean),
    })),
    stepByStep: topics.flatMap(t => t.steps.map((s, i) => ({ title: `${t.title} — step ${i + 1}`, detail: s }))),
    examples: topics.map(t => ({
      title: `${t.title} in practice`,
      detail: `${t.steps[t.steps.length - 1]} In doing that you are applying this idea: ${t.truth}`,
    })),
    codeSnippets: snippets,
    lineByLine: snippets.map(s => ({
      snippet: s.title,
      notes: s.lineNotes.map(n => `Line ${n.line}: ${n.note}`),
    })),
    commonMistakes: topics.flatMap(t => [
      t.mistake,
      `Believing "${t.myth}" — ${t.truth}`,
    ]),
    practicalExercise: def.exercise,
    knowledgeCheck: topics.map((t, i) => {
      const other = topics[(i + 1) % topics.length];
      const options = [t.truth, t.myth, other.myth];
      const answerIndex = i % 3;
      [options[0], options[answerIndex]] = [options[answerIndex], options[0]];
      return {
        question: `Which statement about "${t.title}" is correct?`,
        options,
        answerIndex,
        explanation: `${t.truth} The other options describe common misconceptions.`,
      };
    }),
    recap: [...topics.map(t => t.truth), ...def.recap],
  };
}

/* ── The complete curriculum, in the specified order ─────────────────── */

export const SESSIONS: SessionDefinition[] = [
  {
    id: 's0', orderIndex: 0, title: 'Introduction to Programming',
    subtitle: 'Before a single line of code',
    description: 'Build a mental model of what programming is, how a web page reaches a screen, and how to think when you get stuck.',
    minutes: 240,
    lessons: [
      L('s0-l1', 'A world of instructions', 'You cannot write good instructions until you understand who is reading them. This lesson removes the mystery from what a computer actually does.', ['what-is-programming', 'how-computers-follow-instructions', 'programming-languages'], 'Explain a sandwich to a robot', 'Write the steps for making a sandwich for someone with no common sense. Then mark every step a real computer could not follow without more detail.', ['A computer follows steps literally.', 'Languages are tools for particular places.', 'Everything becomes simple operations eventually.']),
      L('s0-l2', 'What engineers actually do', 'Knowing the difference between "code that works today" and "software that keeps working" changes every habit you build from now on.', ['software-engineering', 'frontend-vs-backend', 'how-websites-work'], 'Map an online shop', 'Draw the path of adding an item to a basket. Label which parts happen in the browser, which on a server, and what has to be checked twice.', ['Engineering is about change over time.', 'The browser is untrusted.', 'A website is a conversation of requests and responses.']),
      L('s0-l3', 'Browsers, servers and databases', 'These three things appear in every application you will ever build. Learn what each one is responsible for.', ['browsers', 'servers', 'databases'], 'Follow one request', 'Write down, in order, what happens between typing an address and seeing a page. Circle where data is saved permanently.', ['Browsers render.', 'Servers enforce rules.', 'Databases persist.']),
      L('s0-l4', 'Setting up your workshop', 'A predictable workspace stops "it works on my computer" problems before they start.', ['code-editors', 'files-folders-projects', 'terminal'], 'Build a tidy project folder', 'Create a project folder with an index.html, a css folder, a js folder and a README. Use the terminal to list it and draw the paths.', ['Editors write plain text.', 'Relative paths connect files.', 'Commands act on the current folder.']),
      L('s0-l5', 'Looking and thinking', 'The two skills that separate beginners from capable engineers are reading what actually happened and having a process when stuck.', ['devtools', 'problem-solving'], 'Inspect and describe', 'Open DevTools on any page, change one CSS value, and describe exactly what you observed. Then write a three-step plan for a task you find difficult.', ['DevTools shows reality, not intentions.', 'Small examples beat guesses.', 'Change one thing at a time.']),
    ],
    project: P('Explain how a website works',
      'Write and illustrate the complete journey from typing a web address to seeing content on screen. Include the address lookup, the request, the server, HTML, CSS, JavaScript, the browser\'s rendering work, and where a database might be involved. No code is required — precision of explanation is the goal.',
      ['A numbered, ordered explanation in your own words', 'Every term you use is defined the first time it appears', 'A simple diagram (boxes and arrows are fine)', 'A short section on what could fail at each stage'],
      ['A reader who has never programmed can repeat the journey back to you', 'Browser, server and database responsibilities are never mixed up', 'It is clear which parts happen once and which repeat on every click', 'No unexplained jargon is left in the text'],
      ['Explain what changes when JavaScript fetches more data later', 'Explain what HTTPS adds to the journey']),
    exam: { title: 'Session 0 — Foundations Examination', minutes: 45, requiresCode: false, practicalPass: 0, brief: 'Conceptual questions and real-world scenarios about how computers, browsers, servers, databases and engineers work. No hints, no answers before submission.' },
  },
  {
    id: 's1', orderIndex: 1, title: 'HTML',
    subtitle: 'Giving content a real structure',
    description: 'Learn to describe the meaning of a document with elements, attributes, forms and semantics — and make it usable by everyone.',
    minutes: 420,
    lessons: [
      L('s1-l1', 'The shape of an HTML document', 'Every page shares one outer skeleton. Understanding it means you never have to guess where something belongs.', ['html-what', 'document-structure', 'elements-tags'], 'Build a bare page', 'Create index.html with a doctype, head, title, body, one heading and one paragraph. Open it in a browser and inspect it.', ['HTML is structure, not logic.', 'Head describes, body displays.', 'Elements are tag + content + closing tag.']),
      L('s1-l2', 'Attributes, nesting and text', 'These three ideas decide whether your markup is understandable or a tangle of crossed tags.', ['attributes', 'nesting', 'text-content'], 'Mark up a recipe', 'Write a page with one h1, an ordered list of steps, an unordered list of ingredients, and a link to a source. Indent the nesting correctly.', ['Attributes live in the opening tag.', 'Close the innermost element first.', 'Headings create an outline, not font sizes.']),
      L('s1-l3', 'Links, images and tables', 'Most of the useful content on the web is a link, an image or a table — and each has a rule that protects the reader.', ['links', 'images-alt', 'tables'], 'Build a resource table', 'Create a table of three learning resources with a header row and a caption. Add one descriptive link and one image with useful alt text.', ['Link text should stand alone.', 'alt text carries meaning, not decoration.', 'Tables are for tabular data only.']),
      L('s1-l4', 'Forms and controls', 'Forms are how a user talks to your application. A well-built form is usable with a keyboard, a screen reader and one hand.', ['forms', 'form-controls'], 'Build a contact form', 'Create a form with a name, an email, a message textarea and a submit button. Every control needs a label, an id, a name and the right type.', ['Labels connect by for/id.', 'name is the key sent to the server.', 'Real buttons work with keyboards.']),
      L('s1-l5', 'Semantics, accessibility and validity', 'Two pages can look identical while one is far easier to use. This lesson is about the difference.', ['semantic-html', 'accessibility-basics', 'proper-structure'], 'Restructure a div soup', 'Take a page made entirely of divs and replace the wrappers with header, nav, main, article and footer. Then tab through it without a mouse.', ['Landmarks help assistive technology.', 'Focus must stay visible.', 'Valid nesting prevents surprises.']),
    ],
    project: P('Build a complete personal profile website',
      'Create a multi-section personal profile site with navigation, a portrait, an about section, a projects section, a skills list and a working contact form. Use only semantic HTML in this project; CSS comes in Session 2.',
      ['Navigation that links to sections on the page', 'At least one image with meaningful alt text', 'A list of projects and a list of skills', 'A contact form with labelled controls and correct input types', 'A meaningful heading outline and page landmarks'],
      ['Every control has a visible label', 'Tab order makes sense with no mouse', 'No heading level is skipped for visual reasons', 'Validation of the markup reports no structural errors', 'All links lead somewhere real or to a real page anchor'],
      ['Add a table of certifications with a caption', 'Add a second page and link between them with relative paths']),
    exam: { title: 'Session 1 — HTML Examination', minutes: 60, requiresCode: true, practicalPass: 70, brief: 'Build a semantic webpage from a written specification, identify structural errors, and explain accessibility decisions. A code editor is provided for the practical task.' },
  },
  {
    id: 's2', orderIndex: 2, title: 'CSS',
    subtitle: 'Making structure feel like a design',
    description: 'From the cascade to Grid, learn how a browser decides what something looks like on a phone and on a large screen.',
    minutes: 480,
    lessons: [
      L('s2-l1', 'Rules, files and selectors', 'CSS is a set of rules, and reading a selector aloud is the fastest way to predict what will change.', ['css-what', 'connecting-css', 'selectors', 'classes-ids'], 'Style your first rule', 'Create style.css, link it from your HTML file, and write three rules using a tag, a class and an id. Check the Network panel.', ['A rule is selector plus declarations.', 'External stylesheets are reusable.', 'Classes style; ids identify.']),
      L('s2-l2', 'Colour, type and surfaces', 'The visual identity of an app is mostly palette, typography and a few carefully controlled surfaces.', ['colours', 'typography', 'backgrounds', 'borders-radius'], 'Design a card', 'Style a card with a defined palette, readable line height, a subtle halftone background and a thick rounded outline. Check contrast.', ['Contrast is a requirement.', 'Line height and measure drive readability.', 'Fallback colours matter.']),
      L('s2-l3', 'The box model', 'Nearly every layout bug is a box-model bug in disguise. Learn the four layers and the one line that fixes most of them.', ['margin-padding', 'box-model', 'display'], 'Inspect three boxes', 'Build three boxes, inspect them in DevTools, and note content, padding, border and margin. Then change box-sizing and compare.', ['Padding is inside; margin outside.', 'border-box includes padding and border.', 'display decides width behaviour.']),
      L('s2-l4', 'Positioning, Flexbox and Grid', 'These are the tools for placing things. Knowing which one to reach for makes layouts calm instead of fragile.', ['positioning', 'flexbox', 'grid'], 'Build a responsive gallery', 'Use Grid for a gallery, Flexbox for the contents of each card, and one sticky header. Explain why you chose each.', ['Absolute needs a positioned ancestor.', 'Flexbox is one-dimensional.', 'Grid is two-dimensional.']),
      L('s2-l5', 'Responsive design and interaction states', 'A mobile-first layout plus visible focus and hover states is what makes an interface feel alive and usable.', ['responsive-design', 'media-queries', 'hover-focus'], 'Shrink it to 320px', 'Starting from a narrow layout, add one breakpoint where your design genuinely breaks. Add hover, active and focus-visible states to every button.', ['Build narrow first.', 'Breakpoints follow content.', 'Keyboard focus must be visible.']),
      L('s2-l6', 'Motion, variables and the cascade', 'Theme tokens and short transitions make an app consistent; understanding specificity keeps it maintainable.', ['transitions-animations', 'css-variables', 'specificity-inheritance'], 'Build a theme', 'Move your palette into custom properties, override them for a dark theme, add a short press transition, and resolve one specificity conflict in DevTools.', ['Custom properties cascade at runtime.', 'Animate transform and opacity.', 'The cascade uses importance, specificity, order.']),
    ],
    project: P('Design a responsive multi-section website',
      'Take the profile site from Session 1 and design it fully. It must work at 320px, 768px and 1440px without horizontal scrolling, with a consistent comic-green visual system, clear typography and tactile interactive states.',
      ['A mobile-first layout with at least one media query', 'A token-based colour system using custom properties', 'Grid or Flexbox for the main layout', 'Hover, active and focus-visible states on all controls', 'Respect for prefers-reduced-motion'],
      ['No horizontal overflow at 320px', 'Text contrast is readable at the smallest size', 'The layout does not rely on fixed pixel widths for content', 'Tabbing shows a visible focus on every control', 'Dark mode changes via tokens, not duplicated rules'],
      ['Add a light/dark toggle that persists the choice', 'Add a subtle halftone texture that does not hurt readability']),
    exam: { title: 'Session 2 — CSS Examination', minutes: 75, requiresCode: true, practicalPass: 70, brief: 'Reproduce a layout from a written design specification, fix deliberately broken CSS, and answer responsive-layout and debugging challenges in the integrated editor.' },
  },
  {
    id: 's3', orderIndex: 3, title: 'JavaScript Fundamentals',
    subtitle: 'Making the page think',
    description: 'Variables, types, conditions, loops, functions, arrays and objects — with real problem-solving practice on each.',
    minutes: 540,
    lessons: [
      L('s3-l1', 'Naming values', 'Every program is about storing and transforming values. This lesson makes the rules of that storage precise.', ['js-what', 'variables', 'let-const-var', 'data-types'], 'Experiment in the Console', 'Declare one const, one let, inspect typeof for five different values, and explain why "5" + 2 gives a string.', ['const by default.', 'Types decide what operations mean.', 'Variables are named boxes.']),
      L('s3-l2', 'Working with text, numbers and truth', 'Most beginner bugs come from strings that look like numbers and truthy values that are not true.', ['strings', 'numbers', 'booleans', 'operators'], 'Normalise user input', 'Write code that takes "  42  " from an input, converts it, doubles it, and prints a formatted message. Test with empty input.', ['Trim before comparing.', 'Use Number() deliberately.', 'Use === and explicit checks.']),
      L('s3-l3', 'Choosing and repeating', 'Conditions choose a path; loops apply the same rule to a collection. Together they make almost any algorithm.', ['conditions', 'if-else-switch', 'loops'], 'Grade a list of scores', 'Given an array of scores, print "pass", "merit" or "resit" for each, then count how many passed. Do one iteration by hand first.', ['Conditions choose once.', 'switch needs break.', 'Loops need an exit.']),
      L('s3-l4', 'Functions and scope', 'Functions turn a complicated idea into a named, testable step. Scope decides which names are visible where.', ['functions', 'parameters-return', 'scope'], 'Extract three functions', 'Rewrite your grading script using a classify(score) function, a countPassing(scores) function and a format(result) function.', ['return sends a value back.', 'Parameters are inputs.', 'Keep scope small.']),
      L('s3-l5', 'Arrays, objects and their methods', 'Real data is almost always an array of objects. Learn the small set of methods that process it cleanly.', ['arrays', 'objects', 'array-methods'], 'Analyse a dataset', 'Given an array of student objects, produce the names of everyone who scored above 80 and the average score, using map/filter/reduce.', ['Indexes start at zero.', 'Objects group named facts.', 'map and filter return new arrays.']),
      L('s3-l6', 'Errors, debugging and problem solving', 'Getting stuck is normal. Having a reliable process is what makes you a capable engineer.', ['errors-exceptions', 'debugging', 'js-problem-solving'], 'Fix a broken script', 'Take a script with three deliberate bugs. Reproduce each, read the error, change one line at a time, and write down the cause of each.', ['try/catch handles failures.', 'Inspect before editing.', 'Define input, output and edges first.']),
    ],
    project: P('Four small JavaScript programs',
      'Build four complete, working programs: a calculator, a number guessing game, an expense calculator and a student grade analyser. Each must handle invalid input and edge cases, not just the happy path.',
      ['Calculator supporting the four basic operations with clear invalid-input handling', 'Number guessing game with feedback and an attempt count', 'Expense calculator that totals a list and reports the largest category', 'Grade analyser that reports average, highest, lowest and pass rate', 'A short README explaining how to run each program'],
      ['No program crashes on empty or non-numeric input', 'Each program produces mathematically correct results for hand-checked examples', 'Functions have descriptive names and single responsibilities', 'Edge cases (zero items, one item, duplicates) are covered', 'You can explain every line of one program aloud'],
      ['Persist expense history with localStorage', 'Add a simple automated test for the grading logic']),
    exam: { title: 'Session 3 — JavaScript Examination', minutes: 90, requiresCode: true, practicalPass: 75, brief: 'Write functions that analyse datasets and handle edge cases, interpret code, fix deliberately broken implementations, and explain your reasoning.' },
  },
  {
    id: 's4', orderIndex: 4, title: 'DOM and Browser Programming',
    subtitle: 'Turning data into interaction',
    description: 'Select, change, create and remove elements; handle events and forms; store data; and separate state from rendering.',
    minutes: 420,
    lessons: [
      L('s4-l1', 'The document as a live tree', 'JavaScript edits an in-memory tree, not your file. That one idea explains most DOM surprises.', ['dom-what', 'selecting-elements', 'changing-content'], 'Inspect a live change', 'Select a heading, change its textContent, and confirm in DevTools that the source file did not change. Explain what is different.', ['The DOM is a live tree.', 'querySelector may return null.', 'textContent is safe for user text.']),
      L('s4-l2', 'Styles, creation and events', 'Keep appearance in CSS and state in JavaScript; attach listeners once and let them change state.', ['manipulating-styles', 'creating-removing', 'event-listeners'], 'Add and remove cards', 'Build a button that appends a new card to a list and a button on each card that removes it. Use classes for styling.', ['classList owns state.', 'Nodes must be attached to appear.', 'Listeners register callbacks.']),
      L('s4-l3', 'Keyboard, forms and storage', 'Real applications must work with a keyboard, give useful validation feedback, and survive a refresh.', ['click-keyboard-events', 'form-handling-validation', 'browser-storage'], 'Validate and remember', 'Build a form that rejects an empty field with an inline message, works when submitted with Enter, and remembers the last valid value after refresh.', ['Native buttons work with keyboards.', 'Validate on the server too.', 'localStorage is per device.']),
      L('s4-l4', 'JSON, modules and clean architecture', 'Split your code into files and let one source of truth drive what is drawn on screen.', ['json', 'modules', 'separating-logic'], 'Refactor into three files', 'Split a task list into data.js, render.js and events.js using import/export. Make one render() draw the whole current state.', ['JSON is text.', 'Modules have their own scope.', 'State drives the view.']),
    ],
    project: P('Build an interactive task manager',
      'Create a task manager where tasks can be added, edited, marked complete, filtered and deleted. All state must live in one array; the DOM is rebuilt from that array.',
      ['Add a task with validation against empty or duplicate names', 'Edit a task in place', 'Toggle completion and filter by all / active / complete', 'Delete a task with a confirmation', 'Persist tasks in localStorage and restore them on load'],
      ['State and DOM never disagree', 'No horizontal overflow on a 360px screen', 'Every action is possible with a keyboard', 'A refresh restores the exact same list', 'No user text is inserted with innerHTML'],
      ['Add due dates and sorting', 'Add an undo for deletion']),
    exam: { title: 'Session 4 — DOM Examination', minutes: 75, requiresCode: true, practicalPass: 75, brief: 'Build a working interactive interface against defined requirements, interpret event-handling code, and fix a deliberately broken implementation.' },
  },
  {
    id: 's5', orderIndex: 5, title: 'Git, GitHub and Development Tools',
    subtitle: 'A safety net for every change',
    description: 'Learn the real workflow: commits, branches, merges, conflicts, pull requests, README files, .gitignore and npm.',
    minutes: 360,
    lessons: [
      L('s5-l1', 'Why history matters', 'Version control is a time machine for your project. Understand the parts before typing a command.', ['version-control', 'git-what', 'github-what', 'repositories'], 'Draw the three states', 'Explain in your own words the difference between the working tree, the staging area and a commit, and where GitHub fits.', ['Git is local and offline.', 'GitHub hosts a copy.', 'A repo includes full history.']),
      L('s5-l2', 'Your first real history', 'Small, purposeful commits are the habit that makes every later project recoverable.', ['git-init', 'tracking-changes', 'staging', 'commits'], 'Make five focused commits', 'Create a repository and make five commits, each with one logical change and a message explaining why. Use git status and git diff --staged each time.', ['Read status before committing.', 'Stage one idea at a time.', 'Messages explain why.']),
      L('s5-l3', 'Branches, merges and conflicts', 'Branching is cheap; conflicts are just a request for a human decision. Learn the safe order of operations.', ['branches', 'merging', 'pull-push', 'merge-conflicts'], 'Create and resolve a conflict', 'Make two branches edit the same line, merge them, resolve the conflict by hand, and commit the result. Then pull and push.', ['Branches are pointers.', 'pull integrates remote work.', 'Resolve conflicts by editing the final content.']),
      L('s5-l4', 'Working with others', 'Pull requests and documentation are how changes get reviewed instead of merely merged.', ['pull-requests', 'readme', 'gitignore'], 'Open a proper pull request', 'Push a branch, open a PR with a clear description, respond to one review comment with a new commit, and write a README with real run commands.', ['A PR is a proposal.', 'README is the front door.', '.gitignore protects secrets.']),
      L('s5-l5', 'npm and packages', 'Modern projects are assembled from packages. Know what the lockfile is for and when not to add one.', ['npm-basics', 'package-management'], 'Create a package', 'Run npm init, add dev/build/test scripts, install one small package, and explain what the lockfile guarantees.', ['package.json declares scripts.', 'Lockfiles pin versions.', 'Fewer dependencies is better.']),
    ],
    project: P('Publish a real repository',
      'Create a repository for one of your earlier projects, commit your changes, create a branch, merge a real improvement, and publish a README that lets someone else run it.',
      ['A public GitHub repository with a meaningful name', 'At least six focused commits', 'A feature branch merged into main', 'A README with install, run and test instructions', 'A .gitignore excluding node_modules, build output and .env', 'A pull request with a description'],
      ['git log shows a readable history', 'The README commands actually work from a clean clone', 'No secret or generated file is tracked', 'The PR diff contains only the intended change', 'You can explain the difference between fetch, pull and push'],
      ['Add a GitHub Actions workflow that runs the build', 'Add a CONTRIBUTING.md']),
    exam: { title: 'Session 5 — Git & GitHub Examination', minutes: 60, requiresCode: false, practicalPass: 0, brief: 'Scenario-based questions about branching mistakes, lost work, conflict recovery, pull request review and dependency hygiene.' },
  },
  {
    id: 's6', orderIndex: 6, title: 'React',
    subtitle: 'Interfaces built from state',
    description: 'Components, JSX, props, state, hooks, forms, routing, reusable pieces and connecting to APIs.',
    minutes: 540,
    lessons: [
      L('s6-l1', 'Thinking in components', 'React changes the question from "which element do I edit?" to "what should the screen look like for this state?".', ['react-what', 'components-why', 'components', 'jsx'], 'Build three components', 'Create a ProgressRing, a LessonCard and a Page component. Pass a title into LessonCard and render a list of them with map.', ['State drives the view.', 'Components are capitalised functions.', 'JSX uses {} for expressions.']),
      L('s6-l2', 'Props, state and events', 'Data flows down, events flow up. This is the whole mental model of a React application.', ['props', 'state', 'usestate', 'react-events'], 'Build a counter with a reset', 'Create a counter with an increment, decrement and reset. Store one number, derive the label, and pass a callback to a child button.', ['Props are read-only.', 'State changes trigger renders.', 'Pass function references to handlers.']),
      L('s6-l3', 'Lists, conditions and forms', 'Every screen has loading/empty/error/success states and usually a list of records with stable keys.', ['conditional-rendering', 'lists-keys', 'react-forms', 'controlled-components'], 'Build a filterable list', 'Render a list of lessons with stable id keys, a text filter, and all four visual states. Use controlled inputs throughout.', ['Keys must be stable.', 'Render four states.', 'Controlled inputs come from state.']),
      L('s6-l4', 'Effects and custom hooks', 'Effects synchronise with the outside world; custom hooks let you reuse stateful logic without copying it.', ['useeffect', 'custom-hooks', 'component-organisation'], 'Write a useLocalStorage hook', 'Extract a hook that reads and writes a JSON value in localStorage with cleanup-safe state, then use it in two components.', ['Effects need dependencies and cleanup.', 'Hooks are top-level only.', 'Small components are easier to change.']),
      L('s6-l5', 'Routing, reuse and data', 'Real apps have URLs, reusable pieces and remote data — with security still enforced on the server.', ['react-router', 'reusable-components', 'api-connect', 'loading-error'], 'Build a two-route dashboard', 'Create a dashboard with a list route and a detail route, one reusable Card component, and a data fetch with abort, loading, error and empty states.', ['Client routing is not authorisation.', 'Props configure reusable pieces.', 'Abort requests on cleanup.']),
    ],
    project: P('Build an interactive student dashboard in React',
      'Create a React dashboard showing sessions, lesson progress, exam status and achievements. It must use components, state, controlled inputs, routing and realistic loading/error states.',
      ['At least eight components with clear responsibilities', 'State held at the nearest common parent', 'A list rendered with stable keys', 'A controlled search/filter input', 'Two routes using React Router', 'Loading, empty, error and success states for data'],
      ['No direct DOM manipulation anywhere in the source', 'Every component can be explained in one sentence', 'Filtering works for empty and duplicate values', 'Keyboard navigation reaches every control', 'The production build succeeds with no type errors'],
      ['Add a custom hook for persisted preferences', 'Add a skeleton loading state']),
    exam: { title: 'Session 6 — React Examination', minutes: 90, requiresCode: true, practicalPass: 75, brief: 'Implement a stateful component from a specification, reason about render behaviour and hooks, and fix a broken React implementation.' },
  },
  {
    id: 's7', orderIndex: 7, title: 'APIs, HTTP and Asynchronous JavaScript',
    subtitle: 'How applications talk to each other',
    description: 'Requests, responses, status codes, fetch, promises, async/await, CORS and authentication basics.',
    minutes: 420,
    lessons: [
      L('s7-l1', 'Contracts between programs', 'An API is an agreement about what to send and what comes back. Learn the vocabulary of that agreement.', ['api-what', 'api-does', 'http', 'request-response'], 'Label one request', 'Take a real request from the Network panel and label its method, URL, headers, body, status and response headers.', ['APIs are contracts.', 'HTTP is stateless.', 'Inspect headers and status.']),
      L('s7-l2', 'Methods, codes and JSON', 'The method says what you intend; the status says what happened; JSON is how the data is written.', ['http-methods', 'status-codes', 'json-api'], 'Classify twenty scenarios', 'For twenty short scenarios, choose the correct method and the status the server should return. Explain three of your choices.', ['GET is safe.', '401 is not 403.', 'JSON needs validation.']),
      L('s7-l3', 'fetch, promises and async/await', 'Asynchronous code is where most beginners lose track of what has happened. Make the sequence explicit.', ['fetch', 'promises', 'async-await', 'error-handling-async'], 'Fetch and display data', 'Write a function that fetches JSON, checks response.ok, handles abort and parse errors separately, and returns a typed result.', ['Check response.ok.', 'await needs try/catch.', 'Aborts are not failures.']),
      L('s7-l4', 'CORS, authentication and integrations', 'The browser and the server share responsibility for safe communication with other systems.', ['cors', 'auth-basics-api', 'frontend-external'], 'Design a safe integration', 'Draw the path of a call that needs a private key. Explain where the key lives, what CORS headers are needed and what the server checks.', ['CORS is browser-enforced.', 'Verify identity server-side.', 'Private keys stay on your backend.']),
    ],
    project: P('Build an API data application',
      'Create an application that retrieves information from a public API and displays clear loading, success, empty and error states, with a working retry.',
      ['A single module responsible for all API calls', 'Loading indicator while waiting', 'Meaningful empty state when no results are returned', 'Error state with a retry button', 'Abort of requests that are no longer needed', 'No private key in frontend code'],
      ['A simulated network failure shows the error state and retry works', 'Rapid repeated searches do not show stale results', 'No unhandled promise rejection appears in the Console', 'The UI never shows a blank screen', 'You can explain the status codes you handled'],
      ['Add caching with a short expiry', 'Add a request timeout with a clear message']),
    exam: { title: 'Session 7 — APIs & Async Examination', minutes: 75, requiresCode: true, practicalPass: 75, brief: 'Debug a broken API integration, implement a specified data-fetching feature with correct loading/error handling, and answer realistic HTTP scenarios.' },
  },
  {
    id: 's8', orderIndex: 8, title: 'Backend Development with Node.js and Express',
    subtitle: 'Rules that run on your server',
    description: 'Build real routes, middleware, validation, error handling, password hashing and authentication fundamentals with Node and Express.',
    minutes: 540,
    lessons: [
      L('s8-l1', 'JavaScript leaves the browser', 'The language is the same; the environment is not. Knowing which globals exist where prevents a lot of confusion.', ['backend-what', 'node-what', 'js-outside-browser', 'npm-server'], 'Run your first server file', 'Create a Node script that prints an environment variable, add dev/start scripts, and explain why document is undefined there.', ['The backend enforces trust.', 'Node uses an event loop.', 'No DOM on a server.']),
      L('s8-l2', 'Servers, Express and routes', 'A server listens, matches a method and path to a handler, and returns exactly one response.', ['modules-server', 'creating-servers', 'express', 'routes'], 'Create three endpoints', 'Build GET /lessons, GET /lessons/:id and POST /lessons. Return correct statuses for found, missing and invalid input.', ['One response per request.', 'Routes map method + path.', 'Validate params.'],),
      L('s8-l3', 'Middleware, controllers and REST', 'Order, separation and consistent HTTP semantics are what make an API pleasant to use.', ['middleware', 'controllers', 'rest-apis', 'crud'], 'Complete a CRUD resource', 'Implement all four operations for one resource with thin controllers, an auth middleware, and a central error handler.', ['Middleware order matters.', 'Controllers stay thin.', 'CRUD needs per-operation checks.']),
      L('s8-l4', 'Validation, errors and configuration', 'Never trust input, never leak internals, and never commit configuration.', ['request-validation', 'server-error-handling', 'env-vars'], 'Harden an endpoint', 'Add schema validation, typed errors mapped to status codes, a .env.example and startup validation of required variables.', ['Validate at the edge.', 'Log internally, respond safely.', 'Secrets are server-side.']),
      L('s8-l5', 'Passwords, sessions and API testing', 'Identity is the part of a backend where shortcuts are most expensive.', ['password-hashing', 'auth-fundamentals', 'api-testing'], 'Build a login route', 'Hash a password with bcrypt, verify it on login, issue a safe cookie, and write a test collection covering success, 401, 403 and 400.', ['Hashes are one-way.', 'Roles come from the database.', 'Test deny paths.']),
    ],
    project: P('Build a functioning backend API',
      'Create a REST API for a small application with persistent storage, validation, authentication, role checks and documented endpoints.',
      ['At least five documented endpoints covering CRUD', 'Schema validation on every write', 'Centralised error handling with safe messages', 'Password hashing and a session mechanism', 'Role checks performed on the server', 'A README/Postman collection with example requests'],
      ['Unauthenticated requests to protected routes return 401', 'A student calling an instructor route returns 403', 'Invalid input returns 400/422 with a field-level message', 'No stack trace or secret appears in any response', 'Every endpoint is tested with valid and invalid input'],
      ['Add rate limiting to the login route', 'Add an audit log for privileged actions']),
    exam: { title: 'Session 8 — Backend Examination', minutes: 90, requiresCode: true, practicalPass: 75, brief: 'Implement a REST endpoint with request validation and appropriate status codes, identify backend bugs, and answer deployment-independent server scenarios.' },
  },
  {
    id: 's9', orderIndex: 9, title: 'Databases and SQL',
    subtitle: 'Data that survives everything',
    description: 'Relational design, keys, relationships, schema design, SQL queries, joins, aggregation, constraints, indexes, migrations and PostgreSQL.',
    minutes: 540,
    lessons: [
      L('s9-l1', 'Tables, rows and columns', 'A database is a set of typed tables with rules, not a big file your app rewrites.', ['db-deep', 'relational', 'tables', 'rows-columns'], 'Design three tables', 'Write CREATE TABLE statements for students, sessions and attempts, naming every column and type.', ['Data is durable and validated.', 'Tables have typed columns.', 'SQL works on sets.']),
      L('s9-l2', 'Keys and relationships', 'Keys are how tables refer to each other without duplicating facts.', ['primary-keys', 'foreign-keys', 'sql-data-types', 'relationships'], 'Link the tables', 'Add primary keys, foreign keys and a junction table where needed. Draw the relationships as boxes and arrows.', ['Primary keys are stable.', 'Foreign keys enforce references.', 'Many-to-many needs a junction table.']),
      L('s9-l3', 'Asking questions with SELECT', 'SQL is declarative: describe the rows you want, and let the database plan the work.', ['schema-design', 'sql', 'select', 'where'], 'Write five queries', 'Write queries for: all students, one student by id, attempts above a score, attempts in a date range, and attempts that are not null.', ['Name columns explicitly.', 'WHERE filters rows.', 'Use IS NULL for nulls.']),
      L('s9-l4', 'Changing data safely', 'INSERT, UPDATE and DELETE are powerful and unforgiving. Preview with SELECT first.', ['insert', 'update', 'delete', 'order-by'], 'Round-trip one record', 'Insert a row with RETURNING id, update one field, confirm with SELECT, then delete it — all inside a transaction you can roll back.', ['Parameterise values.', 'UPDATE needs WHERE.', 'ORDER BY is never implicit.']),
      L('s9-l5', 'Joins and aggregation', 'Most interesting questions span more than one table and need a summary per group.', ['group-by', 'join', 'aggregates'], 'Report per session', 'Write a query that returns each session title with the number of attempts and the average score, including sessions with no attempts.', ['LEFT JOIN keeps unmatched rows.', 'HAVING filters groups.', 'AVG ignores NULLs.']),
      L('s9-l6', 'Constraints, indexes, migrations, PostgreSQL', 'Make the database enforce the rules, keep it fast, and version every structural change.', ['constraints', 'indexes', 'migrations', 'postgres'], 'Write a migration', 'Create a numbered migration adding a CHECK constraint and an index. Apply it, then explain how RLS adds a second security layer.', ['Constraints are the last defence.', 'Measure before indexing.', 'Migrations are versioned SQL.']),
    ],
    project: P('Design and query a relational database',
      'Design a normalized schema for a small learning application, apply it with a migration, seed realistic data, and implement its core queries.',
      ['At least four related tables with primary and foreign keys', 'Appropriate column types and constraints', 'A versioned migration file', 'Queries using WHERE, ORDER BY, GROUP BY and JOIN', 'One query with an aggregate per group', 'A short schema diagram'],
      ['No duplicated student name across attempt rows', 'Every foreign key points to an existing row', 'The JOIN query returns the expected rows for a hand-checked example', 'An INNER and a LEFT JOIN are used correctly and deliberately', 'The migration runs cleanly on an empty database'],
      ['Add EXPLAIN output for one slow query', 'Add a Row Level Security policy and test it as a student']),
    exam: { title: 'Session 9 — Databases & SQL Examination', minutes: 90, requiresCode: true, practicalPass: 70, brief: 'Design a schema, write queries involving relationships, joins, conditions and aggregation, and debug deliberately broken SQL.' },
  },
  {
    id: 's10', orderIndex: 10, title: 'Authentication, Authorisation and Application Security',
    subtitle: 'Who are you, and what may you do?',
    description: 'Sessions, tokens, roles, RLS, injection, XSS, CSRF, secrets, validation, access control and security testing.',
    minutes: 480,
    lessons: [
      L('s10-l1', 'Identity and sessions', 'Authentication and authorisation are different questions with different failure codes.', ['auth-vs-authz', 'hashing-in-practice', 'sessions-vs-tokens', 'jwt'], 'Compare two session designs', 'Write a short comparison of an httpOnly cookie session and a short-lived JWT with refresh tokens, including how you would log out in each.', ['401 is not 403.', 'Hashes are one-way.', 'JWT payloads are readable.']),
      L('s10-l2', 'Roles, permissions and RLS', 'Permissions must be checked at the point of action and, ideally, again in the database.', ['user-roles', 'permissions', 'rls', 'access-control'], 'Write a permission matrix', 'List every action in this academy (view lesson, mark complete, take exam, edit lesson, reset attempt) and which role may do it. Then write one RLS policy.', ['Roles come from trusted data.', 'Check the specific record.', 'RLS is a second layer.']),
      L('s10-l3', 'Attacks you must recognise', 'Injection, XSS and CSRF are not exotic; they are the predictable result of trusting input.', ['sql-injection', 'xss', 'csrf', 'secure-api-design'], 'Audit a vulnerable snippet', 'Given a small login handler with four deliberate vulnerabilities, name each, explain the impact, and rewrite the handler safely.', ['Parameterise queries.', 'Escape or sanitise output.', 'SameSite plus CSRF tokens.']),
      L('s10-l4', 'Secrets, validation and testing security', 'Security is a consistent set of small habits applied to every endpoint.', ['secrets', 'input-validation-security', 'secure-db-policies', 'security-testing'], 'Write deny-path tests', 'Create a test checklist covering unauthenticated, wrong-role, wrong-record, malformed and oversized requests. Then actually run them.', ['Frontend values are public.', 'Allowlist inputs.', 'Test the deny paths.']),
    ],
    project: P('Add secure authentication and role-based access',
      'Take an application with a working backend and add real authentication, role-based access, safe session handling and a documented security review.',
      ['Registration disabled and two seeded accounts only', 'Salted password hashes, no plaintext anywhere', 'httpOnly, Secure, SameSite session cookie', 'Role read from the database on every privileged request', 'Per-record ownership checks', 'RLS policies on user data tables', 'A written list of threats considered and how each is mitigated'],
      ['A student receives 403 on every instructor endpoint', 'A student cannot read another user\'s records by changing an id', 'No secret appears in source, bundle, logs or error responses', 'Logout actually invalidates the session', 'Password and token material are never logged'],
      ['Add rate limiting and account lockout', 'Add an audit trail for privileged actions']),
    exam: { title: 'Session 10 — Security Examination', minutes: 75, requiresCode: true, practicalPass: 70, brief: 'Audit a deliberately flawed authentication implementation, identify vulnerabilities, explain fixes, and answer applied access-control scenarios.' },
  },
  {
    id: 's11', orderIndex: 11, title: 'Testing, Debugging and Code Quality',
    subtitle: 'Proving that it works',
    description: 'Debugging methodology, logging, unit/integration/E2E tests, edge cases, readability, refactoring, accessibility and performance.',
    minutes: 420,
    lessons: [
      L('s11-l1', 'Finding the real cause', 'A reliable reproduction and a bisect are worth more than any lucky guess.', ['debugging-methodology', 'devtools-advanced', 'logging'], 'Debug with a breakpoint', 'Reproduce a bug, pause on the exception, inspect the scope, and write a one-paragraph cause statement. Add one structured log line.', ['Reproduce then isolate.', 'Breakpoints show real values.', 'Logs need structure.']),
      L('s11-l2', 'The three levels of testing', 'Unit, integration and end-to-end tests catch different classes of mistake.', ['unit-testing', 'integration-testing', 'e2e-testing', 'test-cases'], 'Write three tests', 'For one small feature, write one unit test, one integration test against a test database, and one E2E journey. Explain what each would catch.', ['Units are isolated.', 'Integration checks boundaries.', 'E2E checks journeys.']),
      L('s11-l3', 'Edges, errors and accessibility', 'The failures that reach real users live at the boundaries and in the details of keyboard and screen-reader use.', ['edge-cases', 'quality-error-handling', 'a11y-testing'], 'Test the uncomfortable cases', 'Write edge-case tests for empty, zero, duplicate and missing values; then complete one full journey with a keyboard only and record what you had to fix.', ['Enumerate boundaries.', 'Never swallow errors.', 'Test manually too.']),
      L('s11-l4', 'Living with the code', 'Readable code, small refactors, measurement and maintenance keep an application healthy after launch.', ['readability', 'refactoring', 'performance-basics', 'maintenance'], 'Refactor in five steps', 'Take a long function, and with tests passing after each step, extract two helpers, rename three things and measure one performance number before and after.', ['Intent should be obvious.', 'Refactor without changing behaviour.', 'Measure before optimising.']),
    ],
    project: P('Test and improve an existing application',
      'Choose one of your earlier projects. Add a test suite, fix the bugs the tests expose, improve accessibility, and document what changed.',
      ['At least eight meaningful automated tests across unit and integration levels', 'A documented list of edge cases considered', 'Fixes for every bug the tests found', 'A keyboard-only accessibility pass with recorded findings', 'A short before/after performance observation'],
      ['Every test passes from a clean checkout', 'At least one test fails against the original buggy code', 'No empty catch blocks remain', 'Focus is visible on every control', 'The README explains how to run the tests'],
      ['Add a CI workflow that runs the suite', 'Add a small E2E test for the main journey']),
    exam: { title: 'Session 11 — Testing & Quality Examination', minutes: 75, requiresCode: true, practicalPass: 70, brief: 'Diagnose deliberately introduced bugs, write test cases that expose edge cases and incorrect behaviour, and explain each correction.' },
  },
  {
    id: 's12', orderIndex: 12, title: 'Deployment and Production Engineering',
    subtitle: 'From your laptop to real users',
    description: 'Builds, hosting, DNS, HTTPS, environment configuration, CI, Vercel, Supabase, logs, backups, monitoring and troubleshooting.',
    minutes: 420,
    lessons: [
      L('s12-l1', 'What changes in production', 'A production build is not the dev server, and a domain is not hosting.', ['dev-vs-prod', 'production-builds', 'hosting', 'domains'], 'Serve your own build', 'Build an app, serve the dist folder locally, click through every route, and list three differences from the dev server.', ['Test the built output.', 'Builds are compiled bundles.', 'Domains map to infrastructure.']),
      L('s12-l2', 'DNS, HTTPS and secrets', 'These three pieces are the reason "works on localhost" is not the same as "works for users".', ['dns', 'https', 'env-production'], 'Configure a pretend launch', 'Write a launch checklist covering DNS records, certificate renewal, environment variables per environment, and where each secret lives.', ['TTL controls propagation.', 'HTTPS is required.', 'Frontend env values are public.']),
      L('s12-l3', 'Deployment workflows', 'A repeatable pipeline is what makes shipping boring and safe.', ['github-deploy', 'vercel-deploy', 'supabase-config'], 'Set up a preview deploy', 'Connect a repository to a host, set build settings and env vars, open a pull request and test the preview on a narrow viewport.', ['CI runs the checks.', 'Preview deploys are real builds.', 'Supabase needs explicit hardening.']),
      L('s12-l4', 'Keeping it alive', 'Logs, backups, monitoring and a calm troubleshooting process matter more after launch than before.', ['app-logs', 'backups', 'monitoring', 'prod-troubleshooting', 'prod-performance'], 'Write an incident runbook', 'Write a one-page runbook: how to see an error, what to check first, how to roll back, how to restore a backup, and who to tell.', ['Test restores.', 'Alert on user-visible symptoms.', 'Start with the last change.']),
    ],
    project: P('Deploy an application with a backend and database',
      'Take a full-stack project, configure production environments, deploy it, and prove that it works for a real visitor from another device.',
      ['A production build served over HTTPS', 'Separate development and production configuration', 'A managed database with backups enabled', 'A CI workflow that typechecks, tests, builds and deploys', 'Centralised logs and one uptime/error check', 'A README with the production URL and a runbook'],
      ['The deployed app works from a phone on mobile data', 'No secret appears in the repository or client bundle', 'A refresh and a new browser both show persisted data', 'A forced error is visible in logs without exposing private data', 'A documented restore has actually been rehearsed'],
      ['Add a staging environment with a preview per pull request', 'Add a basic performance budget to CI']),
    exam: { title: 'Session 12 — Deployment Examination', minutes: 75, requiresCode: false, practicalPass: 0, brief: 'Diagnose production configuration and deployment failures from realistic evidence, and prepare a project for a production launch.' },
  },
  {
    id: 's13', orderIndex: 13, title: 'Full-Stack Engineering Capstone',
    subtitle: 'Build it yourself, then explain it',
    description: 'An independent full-stack application built from a brief. No complete solution is provided — the design, implementation and explanation must be yours.',
    minutes: 1200,
    lessons: [
      L('s13-l1', 'The brief and the acceptance criteria', 'Before writing code, turn a short brief into a checkable definition of done.', ['capstone-brief', 'capstone-requirements'], 'Write your own specification', 'Choose a problem, rewrite the brief in your own words, and produce at least fifteen testable acceptance criteria covering functionality, security, accessibility and mobile.', ['Restate before building.', 'Criteria are observable.', 'List open questions.']),
      L('s13-l2', 'Plan, design and document', 'Decide the data model, the endpoints, the permissions and the screens before implementing them.', ['capstone-planning', 'capstone-architecture'], 'Draw your system', 'Produce a schema diagram, an endpoint table with methods and permissions, mobile-width screen sketches, and a task board of thin vertical slices.', ['Build one slice end to end.', 'Document decisions.', 'Explain trade-offs.']),
      L('s13-l3', 'Demonstrate and defend your work', 'Your final examination is a demonstration and an explanation of your own implementation.', ['capstone-demo'], 'Rehearse the examination', 'Rehearse a fifteen-minute demonstration: one complete journey, one failure path, one architectural decision and one bug you fixed. Record the questions you could not answer and close them.', ['Show real data.', 'Show failure handling.', 'Explain your own decisions.']),
    ],
    project: P('Capstone: design and build a complete full-stack application',
      'Independently design and build a complete full-stack application of your choosing that solves a real problem for a defined user. This is a written brief and acceptance criteria — no starter template, reference implementation or solution is supplied. The architecture, trade-offs and explanation must be yours.',
      ['Responsive frontend that works on a 320px screen and a desktop', 'React components with functional application state', 'A backend API with validation and error handling', 'A persistent database with a versioned schema', 'Authentication and authorisation with real role checks', 'Data validation on the server', 'Loading, empty, error and success states', 'Secure configuration with no secrets in the repository or client bundle', 'A GitHub repository with a readable history and a real README', 'A production deployment over HTTPS', 'Documentation of architecture, setup and trade-offs'],
      ['A brand-new visitor can sign in and complete the main journey from a phone', 'A signed-out user receives 401 and a wrong-role user receives 403 on protected endpoints', 'Data survives a restart and appears on a second device', 'Invalid input is rejected with a useful message and never corrupts stored data', 'A deliberately triggered failure produces a readable UI state and a server-side log entry', 'No horizontal overflow at 320px and every control is keyboard reachable', 'The production build passes typecheck and tests in CI', 'You can explain the data model, one security decision and one trade-off aloud without notes', 'The README lets another engineer run the project from a clean clone'],
      ['Add automated tests including deny-path checks', 'Add monitoring and an error alert', 'Add a staging environment with preview deployments']),
    exam: { title: 'Session 13 — Capstone Demonstration', minutes: 90, requiresCode: false, practicalPass: 80, brief: 'Demonstrate and explain your own implementation against the capstone acceptance criteria. This is a practical demonstration graded by the instructor; the written questions check that your decisions are genuinely yours.' },
  },
];

export const SESSION_BY_ID: Record<string, SessionDefinition> = Object.fromEntries(SESSIONS.map(s => [s.id, s]));
export const examIdFor = (sessionId: string) => `exam-${sessionId}`;
export const lessonIdFor = (sessionId: string, slug: string) => `lesson-${sessionId}-${slug}`;
