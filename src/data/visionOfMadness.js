/**
 * A Vision of Madness
 * An interactive zine by Kyle Derby MacInnis
 */

const gen = () => 'vom_' + Math.random().toString(36).substr(2, 9);

export const getVisionOfMadnessData = () => ({
    id: 'vision_of_madness',
    title: 'A Vision of Madness',
    author: 'Kyle Derby MacInnis',
    theme: 'noir',
    pages: [
        // COVER PAGE
        {
            id: gen(),
            background: '#050505',
            elements: [
                { id: gen(), type: 'shader', x: 0, y: 0, width: 528, height: 816, shaderPreset: 'plasma', opacity: 0.15, zIndex: 0 },
                { id: gen(), type: 'text', x: 40, y: 150, width: 448, height: 100, content: 'A VISION OF MADNESS', fontSize: 42, fontFamily: 'Cinzel', color: '#e0e0e0', align: 'center', bold: true, zIndex: 2, letterSpacing: 4 },
                { id: gen(), type: 'text', x: 40, y: 250, width: 448, height: 40, content: 'Kyle Derby MacInnis', fontSize: 18, fontFamily: 'EB Garamond', color: '#888', align: 'center', italic: true, zIndex: 2 },
                { id: gen(), type: 'shape', shape: 'line_h', x: 180, y: 310, width: 168, height: 1, fill: '#444', zIndex: 2 },
                { id: gen(), type: 'text', x: 40, y: 340, width: 448, height: 60, content: 'Vancouver | Calgary | Ottawa', fontSize: 14, fontFamily: 'Inter', color: '#666', align: 'center', zIndex: 2 },
                { id: gen(), type: 'text', x: 164, y: 600, width: 200, height: 50, content: 'ENTER THE VOID', fontSize: 14, fontFamily: 'Inter', color: '#000', align: 'center', bold: true, zIndex: 5, action: 'goto', actionVal: '2', fill: '#d4af37', borderRadius: 2, panelBorderWidth: 0 }
            ]
        },
        // VANCOUVER
        {
            id: gen(),
            background: '#121212',
            bgm: 'rain',
            elements: [
                { id: gen(), type: 'shader', x: 0, y: 0, width: 528, height: 816, shaderPreset: 'clouds', opacity: 0.05, zIndex: 0 },
                { id: gen(), type: 'text', x: 40, y: 40, width: 448, height: 50, content: 'Deals for sale', fontSize: 32, fontFamily: 'Cinzel', color: '#d4af37', align: 'left', bold: true, zIndex: 2 },
                { id: gen(), type: 'text', x: 40, y: 90, width: 448, height: 30, content: 'Vancouver, Canada', fontSize: 14, fontFamily: 'Inter', color: '#555', align: 'left', zIndex: 2 },
                {
                    id: gen(), type: 'text', x: 40, y: 140, width: 448, height: 400,
                    content: 'I see steam rising off a moving stream of yellow liquid that catches my eye as I glance at the cracked sidewalk dodging discarded needles and shattered glass pipes. As I look up I catch the sight of a man with brown sweats draped round his tanned ankles and roughly pot-marked legs sticking out of a raincoat draped over what appears to be a grey stained hoodie. I try to pull my gaze away and avoid him there standing against the wall urinating.\n\nI am reminded of when I was a younger boy, for back then the homeless weren’t like this; they at least pissed in the alleyways instead of the main sidewalks. I can’t help but feel a deep longing for past days when the homeless were drunks instead of junkies even with their troubles, but time does not retreat, so too must I try in the moment to pull myself back into the moment and avoid another slumped over body; thank goodness I can see breathing. I keep moving.',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#ccc', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'KEEP MOVING ➔', fontSize: 12, fontFamily: 'Inter', color: '#999', align: 'center', zIndex: 5, action: 'goto', actionVal: '3' }
            ]
        },
        // VANCOUVER - ADHD SPIRAL
        {
            id: gen(),
            background: '#121212',
            elements: [
                {
                    id: gen(), type: 'text', x: 40, y: 60, width: 448, height: 500,
                    content: 'Into the moment… Why are we pulled into the momentary flow in some moments, and trapped in a sea of mud at others. Do we as a species have the capacity to run in flow permanently, or is it meant to be a momentary boost? I find myself constantly wandering from one idea to another, and I am pretty sure this is likely some kind of ADHD or other such disorder yet with all such wanderings I do see many a connection apparently unseen and have used such patterns to my advantage.\n\nI wouldn’t be heading to this interview to secure the biggest deal of my lifetime if I had not been able to bring so many random elements together. This life is a ball of yarn and I am going to knit a pair of stockings worthy of king.',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#ccc', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'shape', shape: 'diamond', x: 244, y: 600, width: 40, height: 40, fill: '#d4af37', opacity: 0.3, zIndex: 1 },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'TO BE A KING ➔', fontSize: 12, fontFamily: 'Inter', color: '#999', align: 'center', zIndex: 5, action: 'goto', actionVal: '4' }
            ]
        },
        // VANCOUVER - DESTINATION
        {
            id: gen(),
            background: '#121212',
            elements: [
                {
                    id: gen(), type: 'text', x: 40, y: 60, width: 448, height: 500,
                    content: 'To be a king would be a noble endeavour, but possibly foolish in this day and age I think. To be a king would have nice perks, but the responsibility almost feels unnecessarily grand these days. Populations of 10’s of millions is too many for one person. I suddenly feel my blood pressure rising and my distaste for governments rising. Perhaps its best I don’t desire any kingship, that would be too hypocritical.\n\nWhat am I thinking? I am not king of anything, and never will be. Damn ADHD, at least I am getting closer to the destination and there are a lot fewer drug addicts now. I wonder if there are deeper reasons that keep them mostly sequestered in “ghetto” areas, or if they do it purely out of convenience for drugs? I am glad I never got into those drugs - I do not really like drinking much either these days, but I did have a good time back in university. Ah……shit, I missed my turn.',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#ccc', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'WRONG TURN ➔', fontSize: 12, fontFamily: 'Inter', color: '#ff4444', align: 'center', zIndex: 5, action: 'goto', actionVal: '5' }
            ]
        },
        // VANCOUVER - CONSTRUCTION
        {
            id: gen(),
            background: '#1a1a1a',
            elements: [
                { id: gen(), type: 'shader', x: 0, y: 0, width: 528, height: 816, shaderPreset: 'plasma', opacity: 0.1, zIndex: 0 },
                {
                    id: gen(), type: 'text', x: 40, y: 60, width: 448, height: 500,
                    content: 'Construction! That is why, I didn’t realize that the construction was on the street I was supposed to turn down…everything is always under construction and yet the speed of completion seems irrespective of the project size. Small projects take just as long as big projects and in both cases, tend to just get torn up one more time.\n\nThe work is perpetually in motion yet never is anyone ever visibly on site. It is one of the great mysteries of our time…not the construction I think that is probably some kind of corruption or loophole that involves mandated “supervision”, “management”, “regulators”, “auditors”, “developers” and of course the civil planning departments and unions.',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#ccc', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'INTO THE MYSTERY ➔', fontSize: 12, fontFamily: 'Inter', color: '#999', align: 'center', zIndex: 5, action: 'goto', actionVal: '6' }
            ]
        },
        // VANCOUVER - ARTIST MARTYRDOM
        {
            id: gen(),
            background: '#1a1a1a',
            elements: [
                {
                    id: gen(), type: 'text', x: 40, y: 60, width: 448, height: 500,
                    content: 'Is this structural, spiritual or mechanical in some way? Are we bred to elect the liars, the cheats the thieves, hold down the artists, punish them to make them creative, and then only after their deaths laud them? Is the work of an artist the martyrdom they end up becoming? They starve to craft beauty that haunts their minds’ eyes and yet they get little recognition until long after they are dead, their piece of art is used as some leverage collateral in a backdoor shady private deal to front for arms dealing of the billionaire elite whilst they bomb and wage wars declaring ‘think of the children’.',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#ccc', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'SELL OUT? ➔', fontSize: 12, fontFamily: 'Inter', color: '#999', align: 'center', zIndex: 5, action: 'goto', actionVal: '7' }
            ]
        },
        // VANCOUVER - THE SPIRAL
        {
            id: gen(),
            background: '#0d0d0d',
            elements: [
                { id: gen(), type: 'shader', x: 0, y: 0, width: 528, height: 816, shaderPreset: 'clouds', opacity: 0.1, zIndex: 0 },
                {
                    id: gen(), type: 'text', x: 40, y: 60, width: 448, height: 500,
                    content: 'Should I become an artist? I could front arms dealers with my creations one day, I think I have the moxie and talent… but does that make me a sellout? Is that selling out - a man has got to eat after all, and I haven’t eaten in twenty-four hours…Who doesn’t sell out? Every one is a sellout… I think human nature is to hold on for a period of time, sell out, regret it, struggle to redeem oneself, and then repeat the cycle again….\n\nWow this is bumming me out. I need to snap out of this funk, this deal requires me at my best, and this is definitely not going to put me in the right headspace.',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#ccc', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'SNAP OUT OF IT ➔', fontSize: 12, fontFamily: 'Inter', color: '#999', align: 'center', zIndex: 5, action: 'goto', actionVal: '8' }
            ]
        },
        // VANCOUVER - COFFEE
        {
            id: gen(),
            background: '#1a1a1a',
            elements: [
                {
                    id: gen(), type: 'text', x: 40, y: 60, width: 448, height: 500,
                    content: 'Running on wheel at least is good for the cardiovascular system, whereas in our modern life I think we end up just getting completely demoralized, drained, distracted, and then amped up for what ever is the latest thing, quickly dropped, and moved onto the next thing with such relentless procession that it feels almost like a law of physics.\n\nA kind of impassable necessity that says and that it be must be that modern life be so unjust that the brightest are snuffed out or they are burnt out through parasitic extraction. Snap of it! My head is just continuing to fall down this spiral of terrible thought. I am in need of some kind of refreshment. I must find a coffee shop soon and grab something to drink.',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#ccc', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'DRINK COFFEE ➔', fontSize: 12, fontFamily: 'Inter', color: '#d4af37', align: 'center', zIndex: 5, action: 'goto', actionVal: '9' }
            ]
        },
        // CALGARY - INTRODUCTION
        {
            id: gen(),
            background: '#f8f8f8',
            elements: [
                { id: gen(), type: 'text', x: 40, y: 40, width: 448, height: 50, content: 'Oh Cows, Moo ye no more.', fontSize: 32, fontFamily: 'Cinzel', color: '#1a1a1a', align: 'left', bold: true, zIndex: 2 },
                { id: gen(), type: 'text', x: 40, y: 90, width: 448, height: 30, content: 'Calgary, Canada', fontSize: 14, fontFamily: 'Inter', color: '#888', align: 'left', zIndex: 2 },
                {
                    id: gen(), type: 'text', x: 40, y: 140, width: 448, height: 500,
                    content: 'The quadrants of the city have begun to skew like pointed rose thorns holding keys of brass turned limey and rough. The old engines of industry have long since quieted, and a new flurry of consumption and polyester tapestries lines the old saloon. The helium balloons of New Year’s parties’ languishing on the the cowboy boots coated in salted brine and frozen sleet. There are no cows in the streets. The cows have gone home to rest.',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#333', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'WHERE ARE THE COWS? ➔', fontSize: 12, fontFamily: 'Inter', color: '#666', align: 'center', zIndex: 5, action: 'goto', actionVal: '10' }
            ]
        },
        // CALGARY - THE VOID
        {
            id: gen(),
            background: '#e8e8e8',
            elements: [
                {
                    id: gen(), type: 'text', x: 40, y: 60, width: 448, height: 500,
                    content: 'The pigeons are roosting, the squirrels do jump, and the geese and the ducks still do fly and swim by, but the cows have gone home and are not in the streets. No more mooing they make, no more milk doth flow down the sides of the old Cow town roads… The beef no longer stunned, but called forth in foreign tongues whilst assassins do swing down on their blades. The bells of the church no longer telling time cannot mourn the sacrifices being made under a call to pray…..The cows are no longer innocent.',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#333', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'HALLOWED CORE ➔', fontSize: 12, fontFamily: 'Inter', color: '#666', align: 'center', zIndex: 5, action: 'goto', actionVal: '11' }
            ]
        },
        // CALGARY - ENTROPY
        {
            id: gen(),
            background: '#dfdfdf',
            elements: [
                {
                    id: gen(), type: 'text', x: 40, y: 60, width: 448, height: 500,
                    content: 'Where once families walked dogs and played with their kin, the signs now forbid them and shame all those who do love the kindness and love that comes from a good ol’ boy’s grin. The schools with girls wrapped in the black, are peppered into the fringe whilst the core gets hollowed out, and swiss-cheesed to make room for the new batch to come in and declare ‘all is welcome’ except for those already in…',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#333', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'COLOURS CHANGED ➔', fontSize: 12, fontFamily: 'Inter', color: '#666', align: 'center', zIndex: 5, action: 'goto', actionVal: '12' }
            ]
        },
        // CALGARY - APATHY
        {
            id: gen(),
            background: '#dcdcdc',
            elements: [
                {
                    id: gen(), type: 'text', x: 40, y: 60, width: 448, height: 500,
                    content: 'Flags still fly, but the colours have changed, and red and white seldom shown…A uneasiness and apathy settles across as I walk down around the downtown alone. The old halls are closed, the bars have new names, and construction is littered around every lane. There’s hardly a place with a old timing feel, and in their place are refuse, and huddled groups of the poorest and ill.',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#333', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'CITY PALACE ➔', fontSize: 12, fontFamily: 'Inter', color: '#666', align: 'center', zIndex: 5, action: 'goto', actionVal: '13' }
            ]
        },
        // CALGARY - CORRUPTION
        {
            id: gen(),
            background: '#d0d0d0',
            elements: [
                {
                    id: gen(), type: 'text', x: 40, y: 60, width: 448, height: 500,
                    content: 'There is a sense of corruption that flows from the site of the City’s grand palace surround by plights of the poor and downtrodden who get nary a fight to make it to the next day alive as they choose between poison and warmth for the night as the blizzards come rolling on in.',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#333', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'PATHWAYS OF WARMTH ➔', fontSize: 12, fontFamily: 'Inter', color: '#666', align: 'center', zIndex: 5, action: 'goto', actionVal: '14' }
            ]
        },
        // CALGARY - FOREIGN GATES
        {
            id: gen(),
            background: '#c8c8c8',
            elements: [
                {
                    id: gen(), type: 'text', x: 40, y: 60, width: 448, height: 500,
                    content: 'A grand old place this once was - truly a sight to behold. We had gardens downtown 3 stories high all year round that weren’t small and mowed into tiled ground, and we had path ways of warmth and lights and a cheer that would beckon in travellers in the cold darks months here….but now they lay half barren, and closed, with foreign security guards holding the doors closed against women and children, against those in need saying the seats are for sitting, the fountains are the be seen. The foreigners have taken the gates - they’ve been seized and the locals are barred from enjoying the feast!',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#333', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'TRUE MEN? ➔', fontSize: 12, fontFamily: 'Inter', color: '#666', align: 'center', zIndex: 5, action: 'goto', actionVal: '15' }
            ]
        },
        // CALGARY - FINALE
        {
            id: gen(),
            background: '#b0b0b0',
            elements: [
                {
                    id: gen(), type: 'text', x: 40, y: 60, width: 448, height: 500,
                    content: 'Men are no longer men in this town of old….they are soy boys now and they do as they are told. A place such as this cannot stand a true man - heroes and legends cannot be formed in pit of dry sand….perhaps if we were to remember the days when the cows were seen in the streets and people would say “Howdy ho, good day, take care, and pray” we would find our way back to the glory of old.\n\nThis place was once wonderful, this place once had cows in the streets. This place was for the locals and cows…..but what is it now?',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#1a1a1a', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'TO THE CAPITAL ➔', fontSize: 12, fontFamily: 'Inter', color: '#1a1a1a', align: 'center', zIndex: 5, action: 'goto', actionVal: '16' }
            ]
        },
        // OTTAWA - INTRODUCTION
        {
            id: gen(),
            background: '#0a1a2a',
            elements: [
                { id: gen(), type: 'shader', x: 0, y: 0, width: 528, height: 816, shaderPreset: 'clouds', opacity: 0.2, zIndex: 0 },
                { id: gen(), type: 'text', x: 40, y: 40, width: 448, height: 80, content: 'A wilted emblem of legacy betrayal', fontSize: 32, fontFamily: 'Cinzel', color: '#e0e0e0', align: 'left', bold: true, zIndex: 2 },
                { id: gen(), type: 'text', x: 40, y: 120, width: 448, height: 30, content: 'Ottawa, Canada', fontSize: 14, fontFamily: 'Inter', color: '#666', align: 'left', zIndex: 2 },
                {
                    id: gen(), type: 'text', x: 40, y: 170, width: 448, height: 500,
                    content: 'Elegies of trucker horns still ring in my ears, mixed with the local pleas for support that get brandished and displayed abroad like some exhibit. I hear the shattered people singing... the mournful calls of a swan called Canada. This baleful sound carries forth, a wistful lullaby for the elites up there in their halls of white ivory and Hudson Bay legacies.\n\nI imagine them in there, partying in private galas of pomp and pizzazz, while out here, people are left to freeze. The lakes are frozen over; I can almost see the elite skating on the ice of our economic woes. Hurrah, they cry out. Hurrah, hurrah indeed. They grow rich while the rest of us are crushed down beneath.',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#aaa', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'BITTER TRUTH ➔', fontSize: 12, fontFamily: 'Inter', color: '#888', align: 'center', zIndex: 5, action: 'goto', actionVal: '17' }
            ]
        },
        // OTTAWA - ELITES
        {
            id: gen(),
            background: '#0a1a2a',
            elements: [
                {
                    id: gen(), type: 'text', x: 40, y: 60, width: 448, height: 500,
                    content: 'Oh, bitter truth is the sweetest of delights for the elitist Laurentian. I bet they’ve never known plight, or strife, or the desperate math of a pension. They’re provided for in those grand halls... it’s been foretold by their prophets and king-makers, their oracles of yore. They got it all first, suckers… why are you so poor?\n\nIt’s a thought that stings. Maybe I should have been born to a corrupted elite; then I’d have more than just leftover meat to look forward to. No, they have to be special. They deign to elect only the finest Wagyu into their brains. No mad cow for them... their madness is a birthright, not the result of slop fed in their chains.',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#aaa', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'NO NEED ➔', fontSize: 12, fontFamily: 'Inter', color: '#888', align: 'center', zIndex: 5, action: 'goto', actionVal: '18' }
            ]
        },
        // OTTAWA - WASTE
        {
            id: gen(),
            background: '#0a1a2a',
            elements: [
                {
                    id: gen(), type: 'text', x: 40, y: 60, width: 448, height: 500,
                    content: 'The elites know nothing of need. Forsooth, nothing of the sort. Not a minor display of necessity, or liveliness, or any other kind of humanity. I can almost hear them laughing from the decks of yachts or the cabins of jets, sipping on port and sherry that costs more than the clothes on my back. I see them spilling it, dropping it, leaving half-finished cups for the flies to buzz around. How wasteful. How cruel.',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#aaa', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'THE SPECTACLE ➔', fontSize: 12, fontFamily: 'Inter', color: '#888', align: 'center', zIndex: 5, action: 'goto', actionVal: '19' }
            ]
        },
        // OTTAWA - PARASITES
        {
            id: gen(),
            background: '#0a1a2a',
            elements: [
                {
                    id: gen(), type: 'text', x: 40, y: 60, width: 448, height: 500,
                    content: 'They decide on the story they’re willing to spread just to cover the tracks of their last hunted thread... the one they tore from the sweater of the poor during the coldest days of yore, just to refasten their gold-rimmed opera glasses. They need to enjoy the spectacle, after all.\n\nTheir laughs are the cries of the servants and slaves they whip under their control. I can feel it in the air... they relish every wince and howl, holding back the lash until the whole crowd has gathered. Shame is sweeter when it\'s shared among friends, isn\'t it? They share this misery like men sharing mead. But these elites aren\'t men, or women, or babes; they’re the parasites that have infected this place.',
                    fontSize: 16, fontFamily: 'EB Garamond', color: '#aaa', align: 'justify', zIndex: 2, lineHeight: 1.6
                },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'ROTTED ROOTS ➔', fontSize: 12, fontFamily: 'Inter', color: '#888', align: 'center', zIndex: 5, action: 'goto', actionVal: '20' }
            ]
        },
        // OTTAWA - FINALE
        {
            id: gen(),
            background: '#050505',
            elements: [
                { id: gen(), type: 'shader', x: 0, y: 0, width: 528, height: 816, shaderPreset: 'plasma', opacity: 0.1, zIndex: 0 },
                {
                    id: gen(), type: 'text', x: 40, y: 60, width: 448, height: 500,
                    content: 'I look up at the trees. The leaves are falling to the ground even though it’s summer... no autumnal signs here. Just withered, poisoned, festering things. They aren\'t alive anymore. It’s a withered old emblem of that grand old tree. The tree of Canada is rotted out from beneath, and I’m just standing here, watching the roots turn to dust.\n\nPoor old maple, what doth sicken thee?',
                    fontSize: 20, fontFamily: 'EB Garamond', color: '#fff', align: 'center', zIndex: 2, lineHeight: 1.6, italic: true
                },
                { id: gen(), type: 'text', x: 40, y: 600, width: 448, height: 40, content: 'FIN', fontSize: 24, fontFamily: 'Cinzel', color: '#d4af37', align: 'center', bold: true, zIndex: 2 },
                { id: gen(), type: 'text', x: 164, y: 720, width: 200, height: 40, content: 'RETURN TO COVER', fontSize: 12, fontFamily: 'Inter', color: '#666', align: 'center', zIndex: 5, action: 'goto', actionVal: '1' }
            ]
        }
    ]
});
