// Static game data: categories, words, hints, and question pairs

export interface WordCategory {
    name: string;
    words: WordEntry[];
}

export interface WordEntry {
    word: string;
    hint: string;
}

export interface QuestionCategory {
    name: string;
    questionPairs: QuestionPair[];
}

export interface QuestionPair {
    question1: string;
    question2: string;
}

export const wordCategories: WordCategory[] = [
    {
        name: 'Love & Relationships',
        words: [
            { word: 'First Kiss', hint: 'A romantic milestone' },
            { word: 'Soulmate', hint: 'The one meant for you' },
            { word: 'Heartbreak', hint: 'Emotional pain from love' },
            { word: 'Marriage', hint: 'Till death do us part' },
            { word: 'Crush', hint: 'Secret admiration' },
            { word: 'Jealousy', hint: 'Green-eyed monster' },
            { word: 'Proposal', hint: 'Will you marry me?' },
            { word: 'Anniversary', hint: 'Yearly celebration' },
        ],
    },
    {
        name: 'Money & Fame',
        words: [
            { word: 'Lottery', hint: 'Lucky numbers' },
            { word: 'Billionaire', hint: 'Extreme wealth' },
            { word: 'Paparazzi', hint: 'Celebrity photographers' },
            { word: 'Bankruptcy', hint: 'Financial ruin' },
            { word: 'Inheritance', hint: 'Money from deceased relatives' },
            { word: 'Red Carpet', hint: 'Celebrity walkway' },
            { word: 'Scandal', hint: 'Public disgrace' },
            { word: 'Stocks', hint: 'Wall Street trading' },
        ],
    },
    {
        name: 'Christmas',
        words: [
            { word: 'Santa Claus', hint: 'He knows if you\'ve been naughty' },
            { word: 'Mistletoe', hint: 'Kiss underneath it' },
            { word: 'Reindeer', hint: 'Rudolph is one' },
            { word: 'Gingerbread', hint: 'Edible house material' },
            { word: 'Caroling', hint: 'Door-to-door singing' },
            { word: 'Stocking', hint: 'Hung by the chimney' },
            { word: 'Eggnog', hint: 'Festive beverage' },
            { word: 'Nutcracker', hint: 'Holiday ballet' },
        ],
    },
    {
        name: 'Food & Drinks',
        words: [
            { word: 'Sushi', hint: 'Japanese raw fish dish' },
            { word: 'Pizza', hint: 'Italian pie' },
            { word: 'Champagne', hint: 'Celebration bubbles' },
            { word: 'Tacos', hint: 'Mexican street food' },
            { word: 'Espresso', hint: 'Strong Italian coffee' },
            { word: 'Chocolate', hint: 'Sweet treat from cocoa' },
            { word: 'Barbecue', hint: 'Grilled and smoked' },
            { word: 'Caviar', hint: 'Expensive fish eggs' },
        ],
    },
    {
        name: 'Movies & TV',
        words: [
            { word: 'Plot Twist', hint: 'Unexpected story turn' },
            { word: 'Cliffhanger', hint: 'Suspenseful ending' },
            { word: 'Blockbuster', hint: 'Big budget hit' },
            { word: 'Sequel', hint: 'Part 2' },
            { word: 'Oscar', hint: 'Academy Award' },
            { word: 'Binge-watching', hint: 'Streaming marathon' },
            { word: 'Spoiler', hint: 'Ruins the surprise' },
            { word: 'Documentary', hint: 'Non-fiction film' },
        ],
    },
];

export const questionCategories: QuestionCategory[] = [
    {
        name: 'Love & Relationships',
        questionPairs: [
            {
                question1: 'What is your biggest green flag in a partner?',
                question2: 'What is your biggest red flag in a partner?',
            },
            {
                question1: 'What was the best date you\'ve ever been on?',
                question2: 'What was the worst date you\'ve ever been on?',
            },
            {
                question1: 'What would you do if your partner proposed unexpectedly?',
                question2: 'What would you do if your partner broke up with you unexpectedly?',
            },
        ],
    },
    {
        name: 'Money & Fame',
        questionPairs: [
            {
                question1: 'What would you do if you won a million dollars?',
                question2: 'What would you do if you lost all your money?',
            },
            {
                question1: 'What would you do if you became famous overnight?',
                question2: 'What would you do if a scandal ruined your reputation?',
            },
            {
                question1: 'What is something you would never spend money on?',
                question2: 'What is something you would always spend money on?',
            },
        ],
    },
    {
        name: 'Life Choices',
        questionPairs: [
            {
                question1: 'If you could go back in time, what advice would you give yourself?',
                question2: 'If you could see the future, what would you want to know?',
            },
            {
                question1: 'What is your biggest accomplishment?',
                question2: 'What is your biggest regret?',
            },
            {
                question1: 'What is a risk you\'re glad you took?',
                question2: 'What is a risk you wish you had taken?',
            },
        ],
    },
    {
        name: 'Hypotheticals',
        questionPairs: [
            {
                question1: 'If you could have any superpower, what would it be?',
                question2: 'If you had to give up one of your senses, which would it be?',
            },
            {
                question1: 'If you could live anywhere in the world, where would it be?',
                question2: 'If you had to leave your country forever, where would you go?',
            },
            {
                question1: 'If you could meet any historical figure, who would it be?',
                question2: 'If you could erase one historical event, what would it be?',
            },
        ],
    },
];

export function getRandomWord(categoryNames: string[]): { word: string; hint: string; category: string } {
    const availableCategories = wordCategories.filter((c) =>
        categoryNames.includes(c.name)
    );
    if (availableCategories.length === 0) {
        throw new Error('No valid categories selected');
    }
    const category = availableCategories[Math.floor(Math.random() * availableCategories.length)];
    const wordEntry = category.words[Math.floor(Math.random() * category.words.length)];
    return {
        word: wordEntry.word,
        hint: wordEntry.hint,
        category: category.name,
    };
}

export function getRandomQuestionPair(categoryNames: string[]): {
    question1: string;
    question2: string;
    category: string;
} {
    const availableCategories = questionCategories.filter((c) =>
        categoryNames.includes(c.name)
    );
    if (availableCategories.length === 0) {
        throw new Error('No valid categories selected');
    }
    const category = availableCategories[Math.floor(Math.random() * availableCategories.length)];
    const pair = category.questionPairs[Math.floor(Math.random() * category.questionPairs.length)];
    return {
        question1: pair.question1,
        question2: pair.question2,
        category: category.name,
    };
}

export function getAllCategoryNames(): { word: string[]; question: string[] } {
    return {
        word: wordCategories.map((c) => c.name),
        question: questionCategories.map((c) => c.name),
    };
}
