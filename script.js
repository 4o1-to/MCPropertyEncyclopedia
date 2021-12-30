
var data;
var value_list = {};

urlParams = new URLSearchParams(window.location.search);
var filter_obj = JSON.parse(urlParams.get("filter")) ?? {};
var sort_arr = JSON.parse(urlParams.get("sort")) ?? [];
var selection_arr = JSON.parse(urlParams.get("selection")) ?? null;
var settings_obj = JSON.parse(urlParams.get("settings")) ?? {};

var page, entry_header, exportable_list;

function load_data(filename) {
    page = document.body.dataset.page;
    switch(page) {
        case "block":
            document.documentElement.style.setProperty('--sprite-url', 'url(assets/BlockCSS.png)');
            entry_header = "Blocks";
            break;

        case "entity":
            document.documentElement.style.setProperty('--sprite-url', 'url(assets/EntityCSS.png)');
            entry_header = "Entities";
            break;

        case "item":
            document.documentElement.style.setProperty('--sprite-url', 'url(assets/ItemCSS.png)');
            entry_header = "Items";
        
    }

    $.ajax({
        'url': filename,
        'dataType': "json",
        'success': function (d) {
            data = d;
            display_selection();
            initialize_settings();
            display_headers_and_table();
        }
    });
}


function display_selection() {
    $('#selection').children().remove();
    if(selection_arr == undefined) {
        selection_arr = [];
        for(let [property_name, value] of Object.entries(data.properties)) {
            if(value.default_selection ?? true) {
                selection_arr.push(property_name);
            }
        }
    }
    Object.keys(data.properties).forEach(property =>{
        selected = selection_arr.includes(property)
        $('#selection').append(`<li><a role="button" class="dropdown-option select-option${selected ? ' selected':''}" property="${property}">${data.properties[property].property_name}
                <span class="glyphicon glyphicon-ok" style="${selected ? 'display:inline-block':'display:none'}">
                </span></a></li>`);
    });
    $('.select-option').click(function(e) {
        e.stopPropagation()
        var value = $(this).attr("property");
        if(selection_arr.includes(value)) {
            selection_arr.splice(selection_arr.indexOf(value), 1);
        } else {
            selection_arr.push(value);
        }
        $(this).children().toggle();
        $(this).toggleClass('selected');
        update_window_history();
        display_headers_and_table();
    });
}

function initialize_settings() {
    $('.radio-settings').click(function(e) {
        var setting = $(this).attr("setting");
        var value = $(this).attr("value");
        if(settings_obj[setting] == value) {
            delete settings_obj[setting];
        } else {
            settings_obj[setting] = value;
        }
        $(this).siblings('a').removeClass('active');
        $(this).toggleClass('active');
        update_window_history();
        display_headers_and_table();
    });
}

// This functions only handles headers, but calls display_results()
function display_headers_and_table() {
    
    $('#output_table').find('thead>tr>th').remove();
    
    for(var [_, property] of Object.entries(data.properties).filter(([e, _]) => selection_arr.includes(e))) {
        var size_factor = 1;
        if(typeof settings_obj.size_type !== 'undefined' && typeof property.size_type !== 'undefined') {
            size_factor /= (property.size_type  == "pixel" ? 16 : 1);
            size_factor *= (settings_obj.size_type == "pixel" ? 16 : 1);
        }
        property.size_factor = size_factor;
    }
    
    // Add all unique values to a list of possible values for each property (recursively so for objects)
    Object.entries(data.properties).filter(([property_name, _]) => selection_arr.includes(property_name)).forEach(([property_name, property]) => {
        value_list[property_name] = [];
        if(property.default_value != null) {
            add_value(value_list[property_name], property.default_value, property);
        }
        add_value(value_list[property_name], property.entries, property);
    });
    function add_value(list, entry, property) {
        if(typeof entry == 'object') {
            Object.values(entry).forEach(value => {
                add_value(list, value, property);
            });
        } else {
            if(entry*1==entry) {
                entry *= property.size_factor;
            }
            if(!list.includes(entry)){
                list.push(entry);
            }
        }
    }
    
    
    // Table headers
    $('#output_table').children('thead').children('tr').append(`<th></th><th><div class="dropdown"><a class="table-header dropdown-toggle justify-start" data-toggle="dropdown">${entry_header}<span class="icons">
        <i class="fas fa-sort-amount-down-alt${sort_arr.some(e => e.property === page) && !sort_arr.filter(e => e.property === page)[0].reversed ? '':' display-none'} sorted"></i>
        <i class="fas fa-sort-amount-up${sort_arr.some(e => e.property === page) && sort_arr.filter(e => e.property === page)[0].reversed ? '':' display-none'} sorted-reverse"></i>
    <span class="glyphicon glyphicon-triangle-bottom"></span>
    </span></a><ul class="dropdown-menu"><li>
    <div class="text-center">
    <span class="btn-group dropdown-btn-group" role="group">
        <a role="button" class="btn dropdown-btn btn-default modify-sorting${(sort_arr.some(e => e.property === page) && !sort_arr.filter(e => e.property === page)[0].reversed) ? ' active' : ''}" property=${page} reversed="false">
            <i class="fas fa-sort-amount-down-alt"></i>
        </a>
        <a role="button" class="btn dropdown-btn btn-default modify-sorting${(sort_arr.some(e => e.property === page) && sort_arr.filter(e => e.property === page)[0].reversed) ? ' active' : ''}" property=${page} reversed="true">
            <i class="fas fa-sort-amount-up"></i>
        </a>
    </span>
    <a role="button" class="btn dropdown-btn btn-default export-csv">
        <i class="fas fa-file-export"></i>Export CSV
    </a>
    </div>
    </li></ul></div></th>`);

    $('.export-csv').click(function (e) {
        var encodedUri = encodeURI("data:text/csv;charset=utf-8," + exportable_list.join('\n'));
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", page+"list.csv");
        document.body.appendChild(link); // Required for FireFox

        link.click();
    });
    
    Object.keys(data.properties).filter(e => selection_arr.includes(e)).forEach(property => {
        append_data = "";
        
        var sorted = 0;
        if(sort_arr.some(e => e.property === property)) {
            if(sort_arr.filter(e => e.property === property)[0].reversed) {
                sorted = -1;
            } else {
                sorted = 1;
            }
        }

        // Header and dropdown buttons
        append_data = `<th><div class="dropdown"><a class="table-header dropdown-toggle justify-start" data-toggle="dropdown">
                ${data.properties[property].property_name}
                <span class="icons">
                <i class="fas fa-sort-amount-down-alt${sorted == 1 ? '':' display-none'} sorted"></i>
                <i class="fas fa-sort-amount-up${sorted == -1 ? '':' display-none'} sorted-reverse"></i>
                <span class="glyphicon glyphicon-triangle-bottom"></span>
                </span></a><ul class="dropdown-menu">
                <li>
                <div class="text-center">
                    <span class="btn-group dropdown-btn-group" role="group">
                        <a role="button" class="btn dropdown-btn btn-default modify-sorting${sorted == 1 ? ' active' : ''}" property="${property}" reversed="false">
                            <i class="fas fa-sort-amount-down-alt"></i>
                        </a>
                        <a role="button" class="btn dropdown-btn btn-default modify-sorting${sorted == -1 ? ' active' : ''}" property="${property}" reversed="true">
                            <i class="fas fa-sort-amount-up"></i>
                        </a>
                        <a role="button" class="btn dropdown-btn btn-default toggle-select-all" property="${property}">
                            <i class="far fa-check-square"></i>
                        </a>
                    </span>
                </div>
                </li>`;
        
        if(typeof data.properties[property].property_description !== 'undefined') {
            append_data += `<li class="dropdown-submenu">
                        <a href="#" class="description-button">Description...</a>
                        <ul class="dropdown-menu">
                            <p>${data.properties[property].property_description}</p>
                        </ul>
                    </li>`;
        }
        append_data += `<li class="divider"></li><div class="dropdown-scrollable">`;

        // Filter menu
        value_list[property].sort().reverse().sort((a, b) => (a - b)).forEach(option => {
            var color = formatting_color(option, property, true);
            append_data += `<li>
                    <a role="button" class="dropdown-option modify-filter" property="${property}" value="${option}">
                    <span class="dot ${color ? color : 'display-none'}"></span>
                    <span class="justify-start">${option}</span>
                    <span class="glyphicon glyphicon-ok${filter_obj[property] !== undefined && filter_obj[property].includes(option) ? ' display-none':''}">
                    </span></a></li>`
        });
        append_data += `</div></ul></div></th>`;
        
        $('#output_table').children('thead').children('tr').append(append_data);
    });
    
    $('.modify-filter').click(function (e) {
        e.stopPropagation();
        
        var property = $(this).attr("property");
        var value = $(this).attr("value");
        
        $(this).children().last().toggleClass("display-none")
        
        // Convert to double if applicable
        value = (value*1 == value) ? value*1 : value;
        if(!Object.keys(filter_obj).includes(property)) {
            filter_obj[property] = [];
        }
        
        if(filter_obj[property].includes(value)) {
            filter_obj[property].splice(filter_obj[property].indexOf(value), 1);
        } else {
            filter_obj[property].push(value);
        }

        if(filter_obj[property].length == 0) {
            delete filter_obj[property];
        }
        update_window_history();
        display_results();
    });

    $('.modify-sorting').click(function (e) {
        e.stopPropagation();

        var property = $(this).attr("property");
        var reversed = $(this).attr("reversed") == 'true';

        if(sort_arr.some(e => e.property === property)) {
            if(sort_arr.filter(e => e.property === property)[0].reversed !== reversed) {
                // If already sorted in the opposite order, reverse the sorting
                sort_arr[sort_arr.findIndex(e => e.property === property)].reversed = reversed;

                $(this).parents('.dropdown').find('.sorted').toggleClass('display-none');
                $(this).parents('.dropdown').find('.sorted-reverse').toggleClass('display-none');
            } else {
                // If already sorted in the same order, remove it
                sort_arr.splice(sort_arr.findIndex(e => e.property === property), 1);

                $(this).parents('.dropdown').find('.sorted').addClass('display-none');
                $(this).parents('.dropdown').find('.sorted-reverse').addClass('display-none');
            }
        } else {
            // If not sorted, sort according to selection
            sort_arr.push({"property":property,"reversed":reversed});

            $(this).parents('.dropdown').find(reversed ? '.sorted-reverse' : '.sorted').removeClass('display-none');
        }
        $(this).siblings('a').removeClass('active');
        $(this).toggleClass('active');
        update_window_history();
        display_results();
    });

    $('.toggle-select-all').click(function (e) {
        e.stopPropagation();

        var property = $(this).attr("property");

        if(filter_obj[property] && value_list[property].every(e => filter_obj[property].includes(e))) {
            delete filter_obj[property];
            $(this).parents('ul').find('.glyphicon').removeClass('display-none');
        } else {
            filter_obj[property] = value_list[property];
            $(this).parents('ul').find('.glyphicon').addClass('display-none');
        }

        update_window_history();
        display_results();
    });
    $('.description-button').click(function (e) {
        e.stopPropagation();
        $(this).parent().toggleClass('open')
    });
    $('.dropdown-submenu>.dropdown-menu').click(function (e) {
        e.stopPropagation();
    });
    display_results();
    
}

// Displays all the table data
function display_results() {
    $('#output_table').find('tbody>tr').remove();
    
    // Table data
    output_data = [];

    // Filtering and "pivoting" (from data to output_data)
    data.key_list.forEach(entry => {
        var output_entry = {[page]: entry};
        var filtered = false;
        for(var [property_id, property] of Object.entries(data.properties).filter(([e, _]) => selection_arr.includes(e))) {
            var selected_element = property.entries[entry];
            var size_factor = property.size_factor ?? 1;
            
            function pivot_element(input_element) {
                if(typeof input_element == 'object') {
                    if(Array.isArray(input_element)) {
                        var output_arr = [];

                        input_element.forEach(element => {
                            var value = pivot_element(element);
                            if(value != undefined) {
                                output_arr.push(value);
                            }
                        });
                        if(output_arr.length == 0) {
                            return;
                        }
                        return output_arr;
                    } else {
                        var output_obj = {};
                        Object.keys(input_element).forEach(variant => {
                            var value = pivot_element(input_element[variant]);
                            if(value != undefined) {
                                output_obj[variant] = pivot_element(input_element[variant]);
                            }
                        });
                        if(Object.keys(output_obj).length == 0) { 
                            return;
                        }
                        return output_obj;
                    }
                } else {
                    input_element = input_element ?? property.default_value;
                    if(input_element*1==input_element) {
                        input_element *= size_factor;
                    }
                    if ((filter_obj[property_id] || []).includes(input_element)){
                        return;
                    } else {
                        return input_element;
                    } 
                }
            }
            
            output_entry[property_id] = pivot_element(selected_element);
            
            if(output_entry[property_id] == undefined) {
                filtered = true;
            }

        }
        if(!filtered) {
            output_data.push(output_entry);
        }
    });

    // For exporting as CSV:
    exportable_list = output_data.map(entry => entry[page] );

    // // For entry count:
    // $('#entry_count').html(output_data.length.toString());

    function deepCopy(obj) {
        if(Array.isArray(obj)) {
            let result = [];
            
            for(let index in obj) {            
                result.push(deepCopy(obj[index]));
            }
            
            return result;
        } else if(typeof obj == 'object') {
            let result = {};
            
            for(let [key, value] of Object.entries(obj)) {
                result[key] = deepCopy(value);
            }
            
            return result;
        }
        
        return obj;
    }

    function sort_properties(data, sort_properties) {
        if(!sort_properties.length) {
            return data;
        }

        // Split
        let split_data = [];
        data.forEach(data_elm => {
            let split_elements = [ deepCopy(data_elm) ];
            
            sort_properties.forEach(property_map => {
                let property = property_map.property;
                let split_element_next = [];
                
                // Loop trough all currently split elements
                split_elements.forEach(val => {
                    
                    split(val, [], property);

                    function split(row, path, property) {
                        var row_copy = deepCopy(row);
                        
                        var pointer = row_copy;
                        path.forEach(key => {
                            pointer = pointer[key];
                        });

                        if (typeof pointer[property] == 'object') {
                            if(Array.isArray(pointer[property])) {
                                var pointer_copy = deepCopy(pointer);
                                for (let i = 0; i < pointer_copy[property].length; i++) {
                                    pointer[property] = [ pointer_copy[property][i] ];
                                    split(row_copy, path.concat(property), i);
                                }
                                
                            } else {
                                for(let [ key, value ] of Object.entries(pointer[property])) {
                                    pointer[property] = { [key]: value };
                                    split(row_copy, path.concat(property), key);
                                }
                            }
                        } else {
                            split_element_next.push(row_copy);
                        }
                    }
                });
                split_elements = split_element_next;
            });
            split_data.push(...split_elements);
        }); 

        // Sort 
        sort_properties.reverse().forEach(property_entry => {
            let property = property_entry.property;
            let reversed = property_entry.reversed;
            split_data.sort((a, b) => {
                let val_0 = (reversed ? b:a)[property];
                let val_1 = (reversed ? a:b)[property];
                
                val_0 = get_value(val_0);
                val_1 = get_value(val_1);
                
                function get_value(value) {
                    if (typeof value == 'object') {
                        for (let prop in value) {
                            return get_value(value[prop]);
                        }
                    } else {
                        return value;
                    }
                }
                
                let result = 0;
                if (typeof val_0 == 'string' || typeof val_1 == 'string') {
                    result = val_0.toString().localeCompare(val_1.toString(), undefined, {numeric: true, sensitivity: 'base'});
                } else {
                    result = val_0 > val_1 ? 1: (val_0 == val_1 ? 0:-1);
                }

                return result;
            });
        });

        return split_data;
    }
    output_data = sort_properties(output_data, sort_arr);
    
    // Table outputting
    output_data.forEach(entry => {
        var append_string = "<tr>";
        var sprite = data.sprites[entry[page]];
        append_string += `<td><span class="sprite ${sprite[0]}" style="background-position:${sprite[1]}px ${sprite[2]}px"></span></td>`;
        for(var [property_id, value] of Object.entries(entry)) {
            append_string += get_data_cell(value, property_id);
        };
        append_string += "</tr>";
        $('#output_table').children('tbody').append(append_string);
    });
    
    function get_data_cell(entry, property_name, top_level = true) {
        var return_data;
        if(typeof(entry) == 'object' && entry != null) {
            if(top_level && ((entry.length || Object.values(entry).length) > 2 || (Object.keys(entry).join().match(/<br>/g) || []).length > 2)) {
                return_data = `<td class="nested-cell"><button class="btn expand-btn" type="button" data-toggle="collapse-next">Expand</button>\n<table class="table table-bordered table-hover nested-table collapse"><tbody>`;
            } else {
                return_data = `<td class="nested-cell"><table class="table table-bordered table-hover nested-table"><tbody>`;
            }
            
            if(Array.isArray(entry)) {
                entry.forEach(value => {
                    return_data += `<tr>${get_data_cell(value, property_name, false)}</tr>`;
                });
            } else {
                Object.keys(entry).forEach(key => {
                    return_data += `<tr><td>${key}</td>${get_data_cell(entry[key], property_name, false)}</tr>`;
                });
            }
            return_data += "</tbody></table></td>";

        } else {
            return_data = `<td ${formatting_color(entry, property_name)}>${entry}</td>`;
        }
        return return_data;
    }

    // Toggle functionality of 'Expand' buttons
    $('body').off('click.collapse-next.data-api');
    $('body').on('click.collapse-next.data-api', '[data-toggle=collapse-next]', function (_e) {
        var $target = $(this).next();
        // Not sure which one I prefer:
        $target.toggle("toggle"); // With toggle animation/delay
        // $target.toggle(); // No toggle animation/delay
    });

}
function formatting_color(value, property_name, class_exists = false) {
    let color = "";
    if(value*1==value){
        value = value*1;

        // Minimum in value is assumed to be 0
        function scale(number, inMax, outMin, outMax) {
            return Math.round(100*((number) * (outMax - outMin) / (inMax) + outMin)) / 100;
        }
        let max = (data.properties[property_name].max ?? 17) * (data.properties[property_name].size_factor ?? 1);
        let colorA = [152,110,208];
        let colorB = [164,221,255];
        if(value < max) {
            // var hue = scale(value, max, 200, 280);
            // color = `style="background-color: hsl(${hue},70%,70%)!important"`;
            
            var r = scale(value, max, colorA[0], colorB[0]);
            var g = scale(value, max, colorA[1], colorB[1]);
            var b = scale(value, max, colorA[2], colorB[2]);
            color = `style="background-color: rgb(${r},${g},${b})!important"`;
        } else {
            // console.log(max, property_name);
            color = `style="background-color: rgb(${colorB[0]}, ${colorB[1]}, ${colorB[2]})"`;
        }
        if(class_exists) {
            color = '"' + color;
        }

    } else if(value in data.conditional_formatting) {
        color = data.conditional_formatting[value];
        if(!class_exists) {
            color = `class="${color}"`;
        }
    }
    return color;
}

function update_window_history() {
    var url = "";
    if(selection_arr != undefined) url += "&selection=" + JSON.stringify(selection_arr);
    if(Object.keys(settings_obj).length > 0) url += "&settings=" + JSON.stringify(settings_obj);
    if(Object.keys(filter_obj).length > 0) url += "&filter=" + JSON.stringify(filter_obj);
    if(sort_arr.length > 0) url += "&sort=" + JSON.stringify(sort_arr);
    if(url != "") {
        url = '?' + url.substr(1) + '#';
    }
    url = window.location.origin + window.location.pathname + url;

    window.history.pushState("", "", url);
}