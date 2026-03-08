import spacy

# load ONCE per process
NLP = spacy.load("en_core_web_sm", disable=["ner", "parser", "textcat"])
