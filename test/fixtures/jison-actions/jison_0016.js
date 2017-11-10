    if ($prec) {
        if ($handle.length === 0) {
            yyerror(rmCommonWS`
                You cannot specify a precedence override for an epsilon (a.k.a. empty) rule!

                  Erroneous area:
                ${yylexer.prettyPrintRange(@handle, @0 /* @handle is very probably NULL! We need this one for some decent location info! */, @action /* ditto! */)}
            `);
        }
        $$.push($prec);
    }
